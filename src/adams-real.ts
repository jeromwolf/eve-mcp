import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RealADAMSDocument {
  accessionNumber: string;  // ML24220A144
  title: string;
  dateAdded: string;
  docDate: string;
  pdfUrl?: string;
}

export class RealADAMSScraper {
  private browser: puppeteer.Browser | null = null;
  
  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  /**
   * 실제 ADAMS 검색 - 모의 데이터 없음
   */
  async searchReal(query: string, maxResults: number = 50): Promise<RealADAMSDocument[]> {
    // console.error(`[REAL ADAMS] Searching for: "${query}"`);
    
    let page: puppeteer.Page | null = null;
    
    try {
      // ADAMS API 직접 호출 시도
      try {
        const apiUrl = 'https://adams-search.nrc.gov/api/search';
        const searchPayload = {
          q: query,
          filters: [],
          legacyLibFilter: true,
          mainLibFilter: true,
          sort: '',
          sortDirection: 1
        };
        
        // console.error(`[REAL ADAMS] Calling API: ${apiUrl}`);
        
        const response = await axios.post(apiUrl, searchPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });
        
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
          
          // console.error(`[REAL ADAMS] Found ${results.length} documents via API`);
          return results;
        }
      } catch (apiError: any) {
        // console.error(`[REAL ADAMS] API failed with ${apiError.response?.status || 'error'}, using browser fallback...`);
      }
      
      // 브라우저로 폴백
      await this.initialize();
      page = await this.browser!.newPage();
      
      // 검색 파라미터 구성
      const searchParams = {
        keywords: query,
        legacyLibFilter: true,
        mainLibFilter: true,
        any: [],
        all: []
      };
      
      // URL 인코딩
      const encodedParams = encodeURIComponent(JSON.stringify(searchParams));
      const searchUrl = `https://adams-search.nrc.gov/results/${encodedParams}`;
      
      // console.error(`[REAL ADAMS] Browser URL: ${searchUrl.substring(0, 100)}...`);
      
      // 페이지 이동
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // 결과 로드 대기 (더 길게)
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // 테이블에서 문서 정보 파싱
      // console.error('[REAL ADAMS] Parsing search results from table...');
      
      const documents = await page.evaluate(() => {
        const results: any[] = [];
        
        // 테이블 행 찾기 (보통 tbody tr 또는 그냥 tr)
        const rows = document.querySelectorAll('tr');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          
          // 최소 3개 이상의 컬럼이 있는 행만 처리
          if (cells.length >= 3) {
            // Accession # 컬럼 (보통 3번째) - 링크가 있는 경우만
            const accessionCell = cells[2];
            if (accessionCell) {
              // 링크 찾기
              const link = accessionCell.querySelector('a');
              
              // 링크가 있는 경우에만 처리 (다운로드 가능한 문서)
              if (link) {
                const accessionText = link.textContent?.trim() || '';
                
                // Accession # 텍스트에서 실제 번호만 추출
                const accessionNumber = accessionText.replace('Accession #', '').trim();
                
                if (accessionNumber && accessionNumber.length >= 8) {
                  // 제목 추출 시도 (보통 4번째 컬럼)
                  const titleCell = cells[3];
                  let title = titleCell?.textContent?.trim() || '';
                  // "Document Title" 접두사 제거
                  title = title.replace('Document Title', '').trim();
                  
                  // 날짜 추출 시도 (보통 5번째나 6번째 컬럼)
                  const dateCell = cells[4] || cells[5];
                  let date = dateCell?.textContent?.trim() || '';
                  // "Date Added" 또는 "Doc Date" 접두사 제거
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
      
      // console.error(`[REAL ADAMS] Found ${documents.length} documents in table`);
      
      // 문서 정보 생성
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
        
        // console.error(`[REAL ADAMS] Returning ${results.length} documents`);
        return results;
      }
      
      // 결과가 없으면 빈 배열 반환
      // console.error('[REAL ADAMS] No documents found');
      return [];
      
    } catch (error) {
      // console.error('[REAL ADAMS] Search error:', error);
      throw new Error(`Search failed: ${error}`);
    } finally {
      if (page) await page.close();
    }
  }
  
  /**
   * 실제 PDF 다운로드 - 모의 데이터 없음
   */
  async downloadRealPDF(documentNumber: string, savePath: string): Promise<boolean> {
    // console.error(`[REAL ADAMS] Downloading: ${documentNumber}`);
    
    try {
      // ADAMS webSearch2 URL 사용
      const pdfUrl = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${documentNumber}`;
      
      // console.error(`[REAL ADAMS] PDF URL: ${pdfUrl}`);
      
      // axios로 직접 다운로드
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*'
        },
        timeout: 60000,
        maxRedirects: 5
      });
      
      const status = response.status;
      // console.error(`[REAL ADAMS] Response status: ${status}`);
      
      if (status === 200 && response.data) {
        const buffer = Buffer.from(response.data);
        
        // PDF 시그니처 확인
        if (buffer.length > 100) {
          const isPDF = buffer.toString('utf8', 0, 4) === '%PDF';
          
          if (isPDF) {
            await fs.writeFile(savePath, buffer);
            // console.error(`[REAL ADAMS] ✓ Saved real PDF to: ${savePath}`);
            // console.error(`[REAL ADAMS] File size: ${buffer.length} bytes`);
            return true;
          } else {
            // console.error(`[REAL ADAMS] Not a PDF, first bytes: ${buffer.toString('utf8', 0, 20)}`);
          }
        }
      }
      
      return false;
      
    } catch (error) {
      // console.error(`[REAL ADAMS] Download error: ${error}`);
      
      // 대체 URL 시도
      try {
        const folder = documentNumber.substring(0, 6);
        const altUrl = `https://www.nrc.gov/docs/${folder}/${documentNumber}.pdf`;
        // console.error(`[REAL ADAMS] Trying alternative URL: ${altUrl}`);
        
        const response = await axios.get(altUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });
        
        if (response.status === 200 && response.data) {
          const buffer = Buffer.from(response.data);
          if (buffer.toString('utf8', 0, 4) === '%PDF') {
            await fs.writeFile(savePath, buffer);
            // console.error(`[REAL ADAMS] ✓ Downloaded via alternative URL`);
            return true;
          }
        }
      } catch (altError) {
        // console.error(`[REAL ADAMS] Alternative download also failed`);
      }
      
      return false;
    }
  }
}