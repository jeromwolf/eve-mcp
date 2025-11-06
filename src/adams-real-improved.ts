import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import logger, { measurePerformance, logError, logRequest, logResponse } from './logger-privacy.js';
import { createKeywordDownloadPath } from './utils.js';

export interface RealADAMSDocument {
  accessionNumber: string;
  title: string;
  dateAdded: string;
  docDate: string;
  pdfUrl?: string;
}

interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

export class ImprovedADAMSScraper {
  private browser: puppeteer.Browser | null = null;
  private browserInitPromise: Promise<void> | null = null;
  private readonly retryOptions: RetryOptions = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  };
  
  // 동적 대기 설정
  private readonly waitOptions = {
    minWait: 5000,    // 최소 5초 대기
    maxWait: 15000,   // 최대 15초 대기로 증가
    checkInterval: 500
  };
  
  // 타임아웃 설정
  private readonly DOWNLOAD_TIMEOUT = 120000; // 2분 (큰 PDF 대응)
  private readonly API_TIMEOUT = 30000; // 30초
  
  async initialize() {
    if (this.browser) return;
    
    if (this.browserInitPromise) {
      await this.browserInitPromise;
      return;
    }
    
    this.browserInitPromise = this._initializeBrowser();
    await this.browserInitPromise;
  }
  
  private async _initializeBrowser() {
    const perf = measurePerformance('Browser initialization');
    try {
      // Windows-compatible Puppeteer configuration
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      };

      // Use custom Chrome path if provided (Windows support)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        logger.info(`Using custom Chrome path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      }

      // Increase timeout for Windows
      launchOptions.timeout = 60000;

      this.browser = await puppeteer.launch(launchOptions);
      logger.info('Browser initialized successfully');
      perf.end(true);
    } catch (error) {
      perf.end(false);
      logError(error, 'Browser initialization failed');
      logger.error('If on Windows, make sure Chrome is installed or set PUPPETEER_EXECUTABLE_PATH');
      throw error;
    }
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserInitPromise = null;
      logger.info('Browser closed');
    }
  }
  
  /**
   * 재시도 로직이 포함된 함수 실행
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.retryOptions.maxAttempts; attempt++) {
      try {
        logger.info(`Attempting ${context} (attempt ${attempt}/${this.retryOptions.maxAttempts})`);
        return await fn();
      } catch (error: any) {
        lastError = error;
        const delay = this.retryOptions.delay * Math.pow(this.retryOptions.backoffMultiplier, attempt - 1);
        
        if (attempt < this.retryOptions.maxAttempts) {
          logger.warn(`${context} failed on attempt ${attempt}, retrying in ${delay}ms`, {
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logError(error, `${context} failed after ${attempt} attempts`);
        }
      }
    }
    
    throw lastError || new Error(`${context} failed after all attempts`);
  }
  
  /**
   * 동적 대기: 요소가 나타날 때까지 대기
   */
  private async waitForResults(page: puppeteer.Page): Promise<boolean> {
    const perf = measurePerformance('Wait for search results');
    const startTime = Date.now();

    // 먼저 최소 대기 시간만큼 기다림
    await new Promise(resolve => setTimeout(resolve, this.waitOptions.minWait));

    while (Date.now() - startTime < this.waitOptions.maxWait) {
      try {
        // Windows 호환성: waitForSelector 사용 (detached frame 방지)
        try {
          await page.waitForSelector('tr', { timeout: this.waitOptions.checkInterval });
        } catch (e) {
          // Selector timeout은 무시하고 계속
        }

        const hasResults = await page.evaluate(() => {
          const rows = document.querySelectorAll('tr');
          // 더 다양한 문서 패턴 확인
          const patterns = [
            /ML\d{8,}/,           // ML documents
            /SECY-\d{2}-\d{4}/,   // SECY documents
            /NUREG-\d{4}/,        // NUREG documents
            /\d{10}/              // 10-digit documents
          ];

          for (let i = 0; i < rows.length; i++) {
            const text = rows[i].innerText || '';
            for (const pattern of patterns) {
              if (pattern.test(text)) {
                return true;
              }
            }
          }
          return false;
        }).catch((err) => {
          logger.warn('Evaluate failed (detached frame?), retrying...', { error: err.message });
          return false;
        });

        if (hasResults) {
          const waitTime = Date.now() - startTime;
          logger.info(`Results found after ${waitTime}ms`);
          perf.end(true, { waitTime });
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, this.waitOptions.checkInterval));
      } catch (error) {
        logger.warn('Wait iteration failed, continuing...', { error: (error as Error).message });
        await new Promise(resolve => setTimeout(resolve, this.waitOptions.checkInterval));
      }
    }

    perf.end(false);
    logger.warn('No results found within timeout period');
    return false;
  }
  
  /**
   * 개선된 ADAMS 검색
   */
  async searchReal(query: string, maxResults: number = 50): Promise<RealADAMSDocument[]> {
    const perf = measurePerformance(`ADAMS search: ${query}`);
    logger.info(`Starting ADAMS search`, { query, maxResults });
    
    let page: puppeteer.Page | null = null;
    
    try {
      // 1. API 시도 (재시도 포함)
      try {
        const results = await this.withRetry(
          () => this.searchViaAPI(query, maxResults),
          'ADAMS API search'
        );
        
        if (results.length > 0) {
          perf.end(true, { resultCount: results.length, method: 'API' });
          return results;
        }
      } catch (apiError) {
        logger.warn('API search failed, falling back to browser', { 
          error: (apiError as Error).message 
        });
      }
      
      // 2. 브라우저 폴백
      await this.initialize();
      page = await this.browser!.newPage();
      
      // 타임아웃 설정
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      
      // 네트워크 최적화
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      const results = await this.withRetry(
        () => this.searchViaBrowser(page!, query, maxResults),
        'Browser search'
      );
      
      perf.end(true, { resultCount: results.length, method: 'Browser' });
      return results;
      
    } catch (error) {
      perf.end(false);
      logError(error, 'ADAMS search failed');
      throw new Error(`Search failed: ${(error as Error).message}`);
    } finally {
      if (page) {
        await page.close().catch(err => 
          logger.warn('Failed to close page', { error: err.message })
        );
      }
    }
  }
  
  /**
   * API를 통한 검색
   */
  private async searchViaAPI(query: string, maxResults: number): Promise<RealADAMSDocument[]> {
    const apiUrl = 'https://adams-search.nrc.gov/api/search';
    const searchPayload = {
      q: query,
      filters: [],
      legacyLibFilter: true,
      mainLibFilter: true,
      sort: '',
      sortDirection: 1
    };
    
    logRequest('POST', apiUrl, searchPayload);
    const startTime = Date.now();
    
    const response = await axios.post(apiUrl, searchPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: this.API_TIMEOUT
    });
    
    logResponse(response.status, apiUrl, Date.now() - startTime);
    
    if (response.data && response.data.results) {
      const results = response.data.results.slice(0, maxResults).map((doc: any) => ({
        accessionNumber: doc.accessionNumber || doc.AccessionNumber || '',
        title: doc.title || doc.Title || doc.DocumentTitle || '',
        dateAdded: doc.dateAdded || doc.DateAdded || '',
        docDate: doc.documentDate || doc.DocumentDate || '',
        pdfUrl: doc.accessionNumber ? 
          `https://www.nrc.gov/docs/${doc.accessionNumber.substring(0, 6)}/${doc.accessionNumber}.pdf` : 
          undefined
      }));
      
      logger.info(`API search successful`, { resultCount: results.length });
      return results;
    }
    
    return [];
  }
  
  /**
   * 브라우저를 통한 검색
   */
  private async searchViaBrowser(
    page: puppeteer.Page,
    query: string,
    maxResults: number
  ): Promise<RealADAMSDocument[]> {
    logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');

    const searchParams = {
      keywords: query,
      legacyLibFilter: true,
      mainLibFilter: true,
      any: [],
      all: []
    };

    const encodedParams = encodeURIComponent(JSON.stringify(searchParams));
    const searchUrl = `https://adams-search.nrc.gov/results/${encodedParams}`;

    logger.info('Navigating to search URL', { url: searchUrl.substring(0, 100) });

    try {
      // Windows 호환성: waitUntil 옵션 변경
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded', // networkidle2 대신 domcontentloaded 사용
        timeout: 60000
      });

      logger.info('✅ Page navigation completed');

      // 추가 대기: 페이지 안정화
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info('✅ Post-navigation wait completed');

    } catch (navError) {
      logger.error('❌ Navigation failed', { error: (navError as Error).message });
      throw new Error(`Navigation failed: ${(navError as Error).message}`);
    }
    
    // 동적 대기
    logger.info('⏳ Waiting for search results...');
    let hasResults = false;
    try {
      hasResults = await this.waitForResults(page);
      logger.info(`✅ waitForResults returned: ${hasResults}`);
    } catch (waitError) {
      logger.error('❌ waitForResults failed', { error: (waitError as Error).message });
      return [];
    }

    if (!hasResults) {
      logger.warn('⚠️ No results found after waiting');
      return [];
    }
    
    // 결과 파싱 (Windows 호환성: try-catch 추가)
    logger.info('📄 Starting page evaluation...');
    let documents: any[] = [];

    // 재시도 로직 추가
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        logger.info(`🔄 Evaluation attempt ${retryCount + 1}/${maxRetries}`);

        // 페이지가 여전히 존재하는지 확인
        if (page.isClosed()) {
          throw new Error('Page is closed');
        }

        documents = await page.evaluate(() => {
          const results: any[] = [];
          const rows = document.querySelectorAll('tr');

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');

          if (cells.length >= 3) {
            const accessionCell = cells[2];
            if (accessionCell) {
              const link = accessionCell.querySelector('a');

              if (link) {
                const accessionText = link.textContent?.trim() || '';
                const accessionNumber = accessionText.replace('Accession #', '').trim();

                if (accessionNumber && accessionNumber.length >= 8) {
                  const titleCell = cells[3];
                  let title = titleCell?.textContent?.trim() || '';
                  title = title.replace('Document Title', '').trim();

                  const dateCell = cells[4] || cells[5];
                  let date = dateCell?.textContent?.trim() || '';
                  date = date.replace('Date Added', '').replace('Doc Date', '').trim();

                  results.push({
                    accessionNumber: accessionNumber,
                  title: title.substring(0, 200) || `${accessionNumber} - NRC Document`,
                  date: date,
                  hasLink: true
                });
              }
            }
          }
        }
        });

          // 중복 제거
          const uniqueResults = results.filter((doc, index, self) =>
            index === self.findIndex(d => d.accessionNumber === doc.accessionNumber)
          );

          return uniqueResults;
        });

        // 성공하면 루프 탈출
        logger.info(`✅ Evaluation successful, found ${documents.length} documents`);
        break;

      } catch (evalError) {
        retryCount++;
        logger.error(`❌ Evaluation attempt ${retryCount} failed`, {
          error: (evalError as Error).message,
          stack: (evalError as Error).stack
        });

        if (retryCount >= maxRetries) {
          logger.error('❌ All evaluation attempts exhausted');
          throw new Error(`Search failed after ${maxRetries} attempts: ${(evalError as Error).message}`);
        }

        // 재시도 전 대기
        logger.info(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`📊 Browser search found ${documents.length} documents`);
    
    if (documents.length > 0) {
      const results = documents.slice(0, maxResults).map(doc => ({
        accessionNumber: doc.accessionNumber,
        title: doc.title || `${doc.accessionNumber} - NRC Document`,
        dateAdded: doc.date || new Date().toISOString().split('T')[0],
        docDate: doc.date || '',
        pdfUrl: doc.accessionNumber.startsWith('ML') 
          ? `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${doc.accessionNumber}`
          : `https://www.nrc.gov/docs/${doc.accessionNumber}.pdf`
      }));
      
      return results;
    }
    
    return [];
  }
  
  /**
   * 개선된 PDF 다운로드 (재시도 로직 포함)
   * @param documentNumber 문서 번호
   * @param savePath 저장 경로 (키워드 포함 시 자동 폴더 생성)
   * @param keyword 선택적 검색 키워드 (폴더 구조용)
   */
  async downloadRealPDF(
    documentNumber: string, 
    savePath: string, 
    keyword?: string
  ): Promise<boolean> {
    const perf = measurePerformance(`PDF download: ${documentNumber}`);
    
    // 키워드가 제공되면 키워드 기반 경로 생성, 아니면 기본 경로 사용
    let finalSavePath = savePath;
    if (keyword) {
      finalSavePath = await createKeywordDownloadPath(keyword, documentNumber);
      logger.info(`Using keyword-based path`, { keyword, path: finalSavePath });
    } else if (!savePath || savePath === '') {
      // savePath가 비어있으면 기본 경로 사용
      finalSavePath = await createKeywordDownloadPath('general', documentNumber);
      logger.info(`Using default path for ${documentNumber}`);
    }
    
    logger.info(`Starting PDF download`, { documentNumber, savePath: finalSavePath });
    
    try {
      // 메인 URL 시도
      const mainUrl = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${documentNumber}`;
      
      const result = await this.withRetry(
        () => this.downloadFromUrl(mainUrl, finalSavePath, documentNumber),
        `Download ${documentNumber}`
      );
      
      if (result) {
        perf.end(true);
        return true;
      }
      
      // 대체 URL 시도
      const folder = documentNumber.substring(0, 6);
      const altUrl = `https://www.nrc.gov/docs/${folder}/${documentNumber}.pdf`;
      
      logger.info(`Trying alternative URL`, { url: altUrl });
      
      const altResult = await this.withRetry(
        () => this.downloadFromUrl(altUrl, finalSavePath, documentNumber),
        `Alternative download ${documentNumber}`
      );
      
      perf.end(altResult);
      return altResult;
      
    } catch (error) {
      perf.end(false);
      logError(error, `Failed to download ${documentNumber}`);
      return false;
    }
  }
  
  /**
   * URL에서 PDF 다운로드
   */
  private async downloadFromUrl(
    url: string,
    savePath: string,
    documentNumber: string
  ): Promise<boolean> {
    logRequest('GET', url);
    const startTime = Date.now();
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*'
      },
      timeout: this.DOWNLOAD_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    logResponse(response.status, url, Date.now() - startTime);
    
    if (response.status === 200 && response.data) {
      const buffer = Buffer.from(response.data);
      
      // PDF 검증
      if (buffer.length > 100 && buffer.toString('utf8', 0, 4) === '%PDF') {
        await fs.writeFile(savePath, buffer);
        
        const stats = await fs.stat(savePath);
        logger.info(`PDF saved successfully`, {
          documentNumber,
          path: savePath,
          size: `${(stats.size / 1024).toFixed(2)} KB`
        });
        
        return true;
      } else {
        logger.warn(`Invalid PDF content`, {
          documentNumber,
          firstBytes: buffer.toString('utf8', 0, 20)
        });
      }
    }
    
    return false;
  }
  
  /**
   * 브라우저 풀 정리
   */
  async cleanup() {
    await this.close();
    logger.info('Scraper cleanup completed');
  }
}