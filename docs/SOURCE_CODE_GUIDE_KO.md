# 소스 코드 상세 가이드

**버전**: 3.0.0
**최종 수정**: 2025-11-07

---

## 목차

1. [index.ts - MCP 서버 메인](#indexts---mcp-서버-메인)
2. [adams-real-improved.ts - 웹 스크래퍼](#adams-real-improvedts---웹-스크래퍼)
3. [rag-engine-enhanced.ts - RAG 엔진](#rag-engine-enhancedts---rag-엔진)
4. [Services - 비즈니스 로직](#services---비즈니스-로직)
5. [Infrastructure - 인프라 서비스](#infrastructure---인프라-서비스)
6. [공통 유틸리티](#공통-유틸리티)

---

## index.ts - MCP 서버 메인

**파일**: `src/index.ts` (901줄)
**역할**: MCP 프로토콜 통신, 요청 라우팅, 6개 tool 제공

### 파일 구조

```
Lines 1-21:   stdout/stderr 제어 (MCP JSON 보호)
Lines 23-48:  모듈 임포트
Lines 50-61:  ADAMSDocument 인터페이스
Lines 63-94:  NRCADAMSMCPServer 클래스 정의
Lines 96-169: setupHandlers() - Tool 등록
Lines 171-240: searchADAMS() - 검색 핸들러
Lines 242-340: downloadDocuments() - 다운로드 핸들러
Lines 342-570: askAboutDocuments() - Q&A 핸들러
Lines 572-620: listDownloadedDocuments() - 목록 핸들러
Lines 622-710: getSearchStatistics() - 통계 핸들러
Lines 712-787: getDownloadStatus() - 진행상태 핸들러
Lines 789-890: loadExistingPDFs() - PDF 자동 로드
Lines 892-901: main() - 서버 시작
```

### 핵심 코드 분석

#### 1. stdout/stderr 제어 (Lines 3-21)

**왜 필요한가?**
- MCP 프로토콜은 stdout으로 JSON-RPC만 전송
- `console.log()` 출력 시 → JSON 파싱 실패
- 모든 디버그 로그는 파일로 저장

```typescript
// Lines 3-9: 원본 함수 저장 및 stderr 완전 차단
const originalStderr = process.stderr.write;
const originalStdout = process.stdout.write;

process.stderr.write = () => true;  // stderr 완전 차단

// Lines 10-21: stdout은 JSON만 허용
const stdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk: any, ...args: any[]): boolean {
  const str = chunk?.toString() || '';

  // JSON 응답만 허용 ('{' 시작 또는 빈 문자열)
  if (str.trim().startsWith('{') || str.trim() === '') {
    return stdoutWrite(chunk, ...args);
  }

  // 모든 비JSON 출력 차단
  return true;
};
```

**중요**: 이 코드 때문에 `console.log()` 사용 불가 → `mcpLogger` 사용 필수!

#### 2. NRCADAMSMCPServer 클래스 (Lines 63-94)

```typescript
class NRCADAMSMCPServer {
  private server: Server;                    // MCP SDK 서버 인스턴스
  private ragEngine: EnhancedRAGEngine;      // RAG 엔진
  private lastSearchResults: ADAMSDocument[] = [];  // 세션 검색 결과
  private lastSearchQuery?: string;          // 마지막 검색어
  private readonly config;

  constructor() {
    // 1. 설정 로드
    this.config = configManager.getConfig();

    // 2. RAG 엔진 초기화
    this.ragEngine = new EnhancedRAGEngine();
    // → OpenAI/Anthropic API 키 확인 및 초기화

    mcpLogger.info('NRC ADAMS MCP Server initializing with modular architecture');

    // 3. PDF 캐시 서비스 초기화 (비동기)
    pdfCacheService.initialize().catch(err => {
      mcpLogger.error('Failed to initialize PDF cache service', { error: err.message });
    });

    // 4. MCP 서버 생성
    this.server = new Server(
      {
        name: "nrc-adams-mcp",
        version: "3.0.0",
      },
      {
        capabilities: {
          tools: {},  // setupHandlers()에서 등록
        },
      }
    );

    // 5. 핸들러 등록
    this.setupHandlers();
  }
}
```

**세션 상태** (Lines 66-67):
- `lastSearchResults`: 검색 결과를 메모리에 보관 (번호 기반 다운로드용)
- `lastSearchQuery`: 폴더명 생성용

#### 3. setupHandlers() - Tool 등록 (Lines 96-169)

```typescript
private setupHandlers(): void {
  // Tool 목록 제공
  this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_adams",
        description: "NRC ADAMS 데이터베이스 검색...",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "검색어" },
            max_results: { type: "number", description: "최대 결과 수 (기본: 20)" }
          },
          required: ["query"]
        }
      },
      // ... 5개 tool 더 정의
    ]
  }));

  // Tool 실행 핸들러
  this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      // 라우팅
      switch (name) {
        case "search_adams":
          return await this.searchADAMS(args.query, args.max_results);
        case "download_adams_documents":
          return await this.downloadDocuments(args.document_numbers, args.count);
        case "ask_about_documents":
          return await this.askAboutDocuments(args.question, args.document_number);
        // ... 나머지 tool
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      // 에러 핸들링
      mcpLogger.error('Tool execution failed', { error });
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
    }
  });
}
```

**6개 Tool**:
1. `search_adams` - ADAMS 검색
2. `download_adams_documents` - 문서 다운로드
3. `ask_about_documents` - RAG Q&A
4. `list_downloaded_documents` - 다운로드 목록
5. `get_search_statistics` - 검색 통계
6. `get_download_status` - 다운로드 진행상태

#### 4. searchADAMS() - 검색 핸들러 (Lines 171-240)

```typescript
private async searchADAMS(query: string, maxResults: number = 20) {
  // 1. 입력 검증
  if (!query || query.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
  }

  mcpLogger.info('ADAMS search initiated via search service', {
    query,
    max_results: maxResults
  });

  // 2. SearchService 호출
  const searchResponse = await searchService.search(query, maxResults);

  // 3. 세션 상태 저장 (메모리)
  this.lastSearchResults = searchResponse.results.map(r => ({
    title: r.title,
    accessionNumber: r.accessionNumber,
    documentNumber: r.documentNumber,
    date: r.date,
    docketNumber: r.docketNumber,
    url: r.url
  }));
  this.lastSearchQuery = query;

  // 4. StateManager에 영속화 (JSON 파일)
  await stateManager.saveSearchResults(query, this.lastSearchResults);

  mcpLogger.info('Search completed via search service', {
    resultCount: searchResponse.totalFound,
    cached: searchResponse.cached,
    searchTime: searchResponse.searchTime
  });

  // 5. MCP 응답 포맷팅
  const responseText = this.formatSearchResults(searchResponse);
  return {
    content: [
      {
        type: "text",
        text: responseText
      }
    ]
  };
}
```

**핵심 포인트**:
- SearchService에 위임 → 캐싱, 통계 자동 처리
- 검색 결과를 메모리 + JSON 파일 양쪽에 저장
- MCP 응답은 항상 `{ content: [{ type: "text", text: "..." }] }` 형식

#### 5. askAboutDocuments() - Q&A 핸들러 (Lines 342-570)

**전체 흐름**:
```typescript
private async askAboutDocuments(question: string, documentNumber?: string) {
  // STEP 1: PDF 자동 로드 (3-9초)
  const { documentsIndexed, totalPdfs, loadTime } = await this.loadExistingPDFs();

  if (documentsIndexed === 0) {
    return {
      content: [{
        type: "text",
        text: "⚠️ No documents indexed. Please download documents first."
      }]
    };
  }

  // STEP 2: RAG 검색 실행
  const results = await this.ragEngine.search(
    question,
    documentNumber,  // 특정 문서 지정 가능
    5                 // 상위 5개
  );

  // STEP 3: document_number 필터링 (2025-09-30 버그 픽스)
  let filteredResults = results;
  if (documentNumber) {
    const beforeFilter = results.length;

    filteredResults = results.filter(r => {
      const metaDocNum = r.metadata.documentNumber || r.metadata.accessionNumber;
      return metaDocNum === documentNumber;
    });

    mcpLogger.info('Filtered results by document_number', {
      documentNumber,
      beforeFilter,
      afterFilter: filteredResults.length
    });

    // 필터 후 결과 없으면 에러
    if (filteredResults.length === 0) {
      // 문서가 로드되었는지 확인
      const availableDocs = this.ragEngine.getAvailableDocuments();

      if (availableDocs.has(documentNumber)) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Document ${documentNumber} is loaded but no matching content found for: "${question}"`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Document ${documentNumber} is not loaded. Available: ${Array.from(availableDocs).join(', ')}`
          }]
        };
      }
    }
  }

  // STEP 4: 답변 생성
  const answer = this.generateAnswer(filteredResults, question);

  // STEP 5: 인용 생성
  const citations = this.formatCitations(filteredResults);

  // STEP 6: 소스 문서 목록
  const sources = this.extractSources(filteredResults);

  // STEP 7: MCP 응답
  return {
    content: [{
      type: "text",
      text: `${answer}\n\n${citations}\n\nSources:\n${sources}`
    }]
  };
}
```

**중요 버그 픽스 (Lines 510-545)**:
- **문제**: `document_number` 파라미터 무시 → 잘못된 문서 결과 반환
- **해결**: RAG 검색 후 `documentNumber`로 명시적 필터링
- **날짜**: 2025-09-30 PM

#### 6. loadExistingPDFs() - PDF 자동 로드 (Lines 789-890)

```typescript
private async loadExistingPDFs(): Promise<{
  documentsIndexed: number;
  totalPdfs: number;
  loadTime: number;
}> {
  const startTime = Date.now();
  let documentsIndexed = 0;

  try {
    // 1. downloaded_pdfs/**/*.pdf 찾기
    const pdfPattern = path.join(
      path.resolve(__dirname, '..'),
      'downloaded_pdfs',
      '**',
      '*.pdf'
    );
    const pdfFiles = await glob(pdfPattern);

    mcpLogger.info(`Found ${pdfFiles.length} PDF files to index`);

    // 2. 각 PDF 처리
    for (const pdfPath of pdfFiles) {
      const filename = path.basename(pdfPath, '.pdf');
      const documentNumber = filename;

      try {
        // 3. PDF 캐시 로드 (Option A: 자동 생성!)
        const content = await pdfCacheService.getCachedText(pdfPath, documentNumber);
        // Line 822: ↑ 여기서 캐시 없으면 자동 추출 + 저장

        if (!content) {
          mcpLogger.warn(`No content for ${documentNumber}`);
          continue;
        }

        // 4. RAG 엔진에 인덱싱
        await this.ragEngine.indexDocument(
          pdfPath,
          documentNumber,
          documentNumber,  // title
          content
        );

        documentsIndexed++;
      } catch (error) {
        mcpLogger.error(`Failed to index ${documentNumber}`, { error });
      }
    }

    const loadTime = Date.now() - startTime;

    mcpLogger.info('PDF indexing complete', {
      documentsIndexed,
      totalPdfs: pdfFiles.length,
      loadTime: `${loadTime}ms`
    });

    return {
      documentsIndexed,
      totalPdfs: pdfFiles.length,
      loadTime
    };
  } catch (error) {
    mcpLogger.error('Failed to load PDFs', { error });
    return { documentsIndexed: 0, totalPdfs: 0, loadTime: 0 };
  }
}
```

**Option A 구현** (Line 822):
- **문제**: PDF 다운로드 후 캐시 파일 자동 생성 안 됨 → "0 documents indexed"
- **해결**: `pdfCacheService.getCachedText()` 호출 → 캐시 없으면 자동 추출
- **날짜**: 2025-09-30 PM
- **결과**: 다운로드 후 바로 Q&A 가능 (1-2초 대기)

---

## adams-real-improved.ts - 웹 스크래퍼

**파일**: `src/adams-real-improved.ts` (605줄)
**역할**: Puppeteer를 이용한 ADAMS 웹사이트 스크래핑 및 PDF 다운로드

### 파일 구조

```
Lines 1-22:   임포트 및 인터페이스
Lines 23-41:  ImprovedADAMSScraper 클래스 정의
Lines 43-53:  initialize() - 싱글톤 패턴
Lines 55-96:  _initializeBrowser() - 브라우저 시작
Lines 98-162: close() - 리소스 정리
Lines 164-260: downloadPDF() - PDF 다운로드
Lines 262-322: searchWithRetry() - 재시도 로직
Lines 324-524: searchReal() - 실제 검색 실행
Lines 526-605: 헬퍼 함수들
```

### 핵심 코드 분석

#### 1. 싱글톤 패턴 (Lines 23-53)

```typescript
export class ImprovedADAMSScraper {
  private browser: puppeteer.Browser | null = null;
  private browserInitPromise: Promise<void> | null = null;

  // 재시도 설정
  private readonly retryOptions: RetryOptions = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  };

  // 동적 대기 설정
  private readonly waitOptions = {
    minWait: 5000,    // 최소 5초
    maxWait: 15000,   // 최대 15초
    checkInterval: 500
  };

  // 타임아웃
  private readonly DOWNLOAD_TIMEOUT = 120000; // 2분
  private readonly API_TIMEOUT = 30000;       // 30초

  async initialize() {
    // 이미 브라우저 있음 - 즉시 반환
    if (this.browser) return;

    // 초기화 진행 중 - 대기
    if (this.browserInitPromise) {
      await this.browserInitPromise;
      return;
    }

    // 새로운 초기화 시작
    this.browserInitPromise = this._initializeBrowser();
    await this.browserInitPromise;
  }
}
```

**싱글톤 패턴의 이유**:
- Puppeteer 브라우저 시작은 비용이 큼 (3-5초)
- 여러 검색 요청을 동일 브라우저로 처리
- `initialize()` 중복 호출해도 한 번만 시작

**Windows 디버깅 포인트** (Line 44):
```typescript
if (this.browser) return;  // ← 여기서 early return 시 _initializeBrowser() 실행 안 됨
```
- Windows 버그: 브라우저 초기화 로그가 안 나오는 이유
- 브라우저가 이미 존재 → 새 설정 적용 안 됨

#### 2. _initializeBrowser() - 플랫폼별 설정 (Lines 55-96)

```typescript
private async _initializeBrowser() {
  const perf = measurePerformance('Browser initialization');

  try {
    // 플랫폼 감지
    const isWindows = process.platform === 'win32';

    // Windows vs Mac 설정
    const launchOptions: any = {
      headless: isWindows ? false : true,  // Windows: 브라우저 표시
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',

        // Windows 추가 플래그
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized'
      ]
    };

    // Windows: 긴 타임아웃
    launchOptions.timeout = isWindows ? 120000 : 60000;

    logger.info(`🔧 Platform: ${process.platform}, Headless: ${launchOptions.headless}, Timeout: ${launchOptions.timeout}ms`);

    // Puppeteer 시작
    this.browser = await puppeteer.launch(launchOptions);

    logger.info('✅ Browser initialized successfully');
    perf.end(true);

  } catch (error) {
    logger.error('Browser initialization failed', { error });
    perf.end(false);
    throw error;
  }
}
```

**플랫폼별 차이**:

| 설정 | Mac | Windows |
|------|-----|---------|
| headless | `true` (백그라운드) | `false` (화면 표시) |
| timeout | 60초 | 120초 (2배) |
| 대기 시간 | 2초 | 5초 (2.5배) |

**Windows headless: false 이유**:
- Windows Puppeteer는 headless 모드에서 불안정
- 브라우저 창을 표시하면 안정성 향상
- 디버깅 시 실제 페이지 확인 가능

#### 3. searchReal() - 실제 검색 (Lines 324-524)

**전체 흐름**:
```typescript
async searchReal(query: string, limit: number = 20): Promise<RealADAMSDocument[]> {
  const perf = measurePerformance('ADAMS real search');

  try {
    // STEP 1: 브라우저 초기화
    await this.initialize();

    // STEP 2: 새 페이지 열기
    const page = await this.browser!.newPage();

    // STEP 3: 검색 URL 생성
    const searchUrl = `https://adams-search.nrc.gov/results/?q=${encodeURIComponent(query)}&s=header-search-box&tab=nuclear-reactors`;

    logger.info('Navigating to ADAMS search', { query, limit, url: searchUrl });

    // STEP 4: 플랫폼별 네비게이션
    const isWindows = process.platform === 'win32';

    // Windows: User-Agent 설정
    if (isWindows) {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...');
      logger.info('🔧 Windows User-Agent set');
    }

    // 페이지 이동
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',  // networkidle2 대신 (더 빠름)
      timeout: isWindows ? 90000 : 60000
    });

    logger.info('✅ Page navigation completed');

    // STEP 5: 동적 콘텐츠 대기
    const waitTime = isWindows ? 5000 : 2000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    logger.info(`✅ Post-navigation wait completed (${waitTime}ms)`);

    // STEP 6: 테이블 HTML 추출
    const tableHtml = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table ? table.innerHTML : null;
    });

    if (!tableHtml) {
      throw new Error('No table found on page');
    }

    logger.info('✅ Table HTML extracted');

    // STEP 7: Cheerio로 파싱
    const $ = cheerio.load(`<table>${tableHtml}</table>`);
    const documents: RealADAMSDocument[] = [];

    $('tr').each((index, row) => {
      if (index === 0) return; // 헤더 스킵

      const cells = $(row).find('td');
      if (cells.length < 3) return;

      // 셀에서 데이터 추출
      const titleCell = $(cells[0]);
      const link = titleCell.find('a').first();
      const title = link.text().trim();
      const href = link.attr('href');

      // ML 번호 추출
      const accessionNumber = this.extractAccessionNumber(title || href || '');

      if (!accessionNumber) return; // ML 번호 없으면 스킵

      // 날짜 추출
      const dateAdded = $(cells[1]).text().trim();
      const docDate = $(cells[2]).text().trim();

      documents.push({
        accessionNumber,
        title: title || accessionNumber,
        dateAdded,
        docDate,
        pdfUrl: href
      });
    });

    // STEP 8: 결과 제한
    const limitedDocs = documents.slice(0, limit);

    logger.info('Search completed', {
      totalFound: documents.length,
      returned: limitedDocs.length
    });

    await page.close();
    perf.end(true);

    return limitedDocs;

  } catch (error) {
    logger.error('Search failed', { query, error });
    perf.end(false);
    throw new Error(`Search failed: ${error.message}`);
  }
}
```

**핵심 포인트**:

1. **waitUntil: 'domcontentloaded'**
   - `networkidle2` 대신 사용 (더 빠름)
   - ADAMS는 초기 HTML만 있으면 파싱 가능

2. **동적 대기 시간**
   - Windows: 5초 (안정성)
   - Mac: 2초 (속도)

3. **Cheerio 파싱**
   - Puppeteer evaluate()는 복잡한 DOM 조작 어려움
   - HTML 추출 후 Cheerio로 파싱 (jQuery 스타일)

4. **ML 번호만 반환**
   - `extractAccessionNumber()`: ML, NUREG, SECY 등 인식
   - 다운로드 링크 없는 문서 제외

#### 4. downloadPDF() - PDF 다운로드 (Lines 164-260)

```typescript
async downloadPDF(accessionNumber: string, outputPath: string): Promise<boolean> {
  const perf = measurePerformance('PDF download');

  try {
    // ADAMS PDF URL
    const url = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${accessionNumber}`;

    logger.info('Downloading PDF', { accessionNumber, url, outputPath });

    // Axios로 직접 다운로드 (브라우저 불필요!)
    const response: AxiosResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: this.DOWNLOAD_TIMEOUT,
      maxContentLength: 100 * 1024 * 1024,  // 100MB
      headers: {
        'User-Agent': 'Mozilla/5.0 ...'
      }
    });

    // PDF 검증
    const buffer = Buffer.from(response.data);
    const isPDF = buffer.slice(0, 4).toString() === '%PDF';

    if (!isPDF) {
      throw new Error('Downloaded file is not a valid PDF');
    }

    // 파일 저장
    await fs.writeFile(outputPath, buffer);

    const fileSizeKB = Math.round(buffer.length / 1024);
    logger.info('PDF downloaded successfully', {
      accessionNumber,
      size: `${fileSizeKB} KB`,
      path: outputPath
    });

    perf.end(true);
    return true;

  } catch (error) {
    logger.error('PDF download failed', { accessionNumber, error });
    perf.end(false);
    return false;
  }
}
```

**왜 Axios?**
- PDF 다운로드는 단순 GET 요청
- Puppeteer 브라우저 필요 없음 (리소스 절약)
- 더 빠르고 안정적

**PDF 검증**:
- `%PDF` 시그니처 확인
- HTML 에러 페이지 다운로드 방지

---

## rag-engine-enhanced.ts - RAG 엔진

**파일**: `src/rag-engine-enhanced.ts` (431줄)
**역할**: 벡터 임베딩 기반 문서 검색 및 Q&A

### 파일 구조

```
Lines 1-29:   임포트 및 인터페이스
Lines 31-52:  EnhancedRAGEngine 클래스
Lines 54-141: splitIntoChunksWithPages() - 페이지 추적
Lines 142-231: indexDocument() - 문서 인덱싱
Lines 233-251: extractSection() - 섹션 추출
Lines 253-340: search() - RAG 검색
Lines 342-360: cosineSimilarity() - 벡터 유사도
Lines 362-388: keywordSimilarity() - 키워드 검색
Lines 390-427: getStatistics() - 통계
Lines 429-431: getAvailableDocuments() - 로드된 문서
```

### 핵심 코드 분석

#### 1. EnhancedRAGEngine 초기화 (Lines 31-52)

```typescript
export class EnhancedRAGEngine {
  private documents: Map<string, DocumentChunk[]> = new Map();
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  public provider: 'openai' | 'anthropic' | 'none' = 'none';

  // 성능 최적화된 청크 크기
  private readonly CHUNK_SIZE = 2000;      // 500 → 2000 (4배)
  private readonly CHUNK_OVERLAP = 200;    // 50 → 200 (4배)

  constructor() {
    // API 키 우선순위: OpenAI > Anthropic > none
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.provider = 'openai';
      mcpLogger.info('RAG: OpenAI provider initialized');

    } else if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.provider = 'anthropic';
      mcpLogger.info('RAG: Anthropic provider initialized');

    } else {
      // 키 없음 - 키워드 검색으로 폴백
      mcpLogger.warn('RAG: No API key found, using keyword search');
    }
  }
}
```

**청크 크기 최적화**:
- 500자 → 2000자: 임베딩 API 호출 75% 감소
- 오버랩 유지: 문맥 연속성 보장

**API 키 폴백**:
1. OpenAI (최우선) - 가장 빠름
2. Anthropic (차선) - Claude API
3. 없음 - 키워드 검색 (정확도 낮음)

#### 2. splitIntoChunksWithPages() - 페이지 추적 (Lines 54-141)

```typescript
private splitIntoChunksWithPages(text: string, totalPages?: number): Array<{
  text: string;
  pageNumber: number;
  startLine: number;
  endLine: number;
}> {
  const chunks: Array<{ ... }> = [];

  // 페이지 패턴 감지
  const pagePattern = /(?:Page|PAGE)\s*(\d+)(?:\s*of\s*\d+)?|^\d+\s*$/gm;
  const lines = text.split('\n');

  let currentPage = 1;
  let currentChunk = '';
  let startLine = 0;

  // 페이지당 라인 수 추정
  const estimatedLinesPerPage = totalPages ? Math.ceil(lines.length / totalPages) : 60;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 페이지 번호 감지
    const pageMatch = line.match(pagePattern);
    if (pageMatch && pageMatch[1]) {
      const detectedPage = parseInt(pageMatch[1]);

      if (detectedPage > currentPage) {
        // 현재 청크 저장
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk,
            pageNumber: currentPage,
            startLine: startLine,
            endLine: i - 1
          });
        }

        currentPage = detectedPage;
        currentChunk = '';
        startLine = i;
      }
    }

    // 청크에 라인 추가
    currentChunk += line + '\n';

    // CHUNK_SIZE 도달 또는 페이지 경계
    if (currentChunk.length >= this.CHUNK_SIZE || i === lines.length - 1) {
      // ... 청크 분할 로직
    }
  }

  return chunks;
}
```

**페이지 추적 방법**:
1. PDF 텍스트에서 "Page 15" 패턴 찾기
2. 페이지 번호 변경 시 청크 분할
3. 라인 번호 기록 (시작-끝)

**인용 형식 생성**:
```
[ML24275A095] Page 15 of 250 - Section 3.2 (Lines 450-475)
```

#### 3. indexDocument() - 문서 인덱싱 (Lines 142-231)

```typescript
async indexDocument(
  filePath: string,
  documentNumber: string,
  title: string,
  content?: string
): Promise<void> {
  mcpLogger.info('Indexing document', { documentNumber, title });

  try {
    // STEP 1: 텍스트 로드
    const text = content || await extractTextFromPDF(filePath);

    if (!text || text.length === 0) {
      throw new Error('No text content extracted');
    }

    // STEP 2: 총 페이지 수 추정
    const totalPages = this.estimateTotalPages(text);

    // STEP 3: 페이지별 청크 분할
    const chunksWithPages = this.splitIntoChunksWithPages(text, totalPages);

    mcpLogger.info('Document split into chunks', {
      documentNumber,
      totalChunks: chunksWithPages.length,
      totalPages
    });

    // STEP 4: DocumentChunk 생성
    const documentChunks: DocumentChunk[] = [];

    for (const chunk of chunksWithPages) {
      const docChunk: DocumentChunk = {
        text: chunk.text,
        metadata: {
          documentNumber,
          title,
          filename: path.basename(filePath),
          chunkIndex: documentChunks.length,
          startChar: 0,  // 업데이트 필요 시
          endChar: chunk.text.length,

          // 📄 페이지 정보
          pageNumber: chunk.pageNumber,
          totalPages: totalPages,
          section: this.extractSection(chunk.text),
          lineNumbers: [chunk.startLine, chunk.endLine]
        }
      };

      // STEP 5: 임베딩 생성 (OpenAI/Anthropic)
      if (this.provider === 'openai' && this.openai) {
        try {
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: chunk.text
          });
          docChunk.embedding = response.data[0].embedding;

        } catch (embeddingError) {
          mcpLogger.error('Embedding failed', { documentNumber, error: embeddingError });
          // 임베딩 실패 시 키워드 검색으로 폴백
        }

      } else if (this.provider === 'anthropic' && this.anthropic) {
        // Anthropic은 임베딩 API 없음 - 키워드 검색
        mcpLogger.warn('Anthropic does not support embeddings, using keyword search');
      }

      documentChunks.push(docChunk);
    }

    // STEP 6: 메모리에 저장
    this.documents.set(documentNumber, documentChunks);

    mcpLogger.info('Document indexed successfully', {
      documentNumber,
      chunks: documentChunks.length,
      withEmbeddings: documentChunks.filter(c => c.embedding).length
    });

  } catch (error) {
    mcpLogger.error('Document indexing failed', { documentNumber, error });
    throw error;
  }
}
```

**임베딩 폴백 전략**:
1. OpenAI 임베딩 성공 → 벡터 검색
2. OpenAI 실패 → 키워드 검색
3. Anthropic → 키워드 검색 (임베딩 API 없음)

**중요**: 임베딩 실패해도 인덱싱은 계속 (0 chunks 버그 방지)

#### 4. search() - RAG 검색 (Lines 253-340)

```typescript
async search(
  query: string,
  documentNumber?: string,
  topK: number = 5
): Promise<SearchResult[]> {
  mcpLogger.info('RAG search started', {
    query,
    documentNumber,
    topK,
    provider: this.provider
  });

  // STEP 1: 쿼리 임베딩 생성
  let queryEmbedding: number[] | undefined;

  if (this.provider === 'openai' && this.openai) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query
      });
      queryEmbedding = response.data[0].embedding;

    } catch (error) {
      mcpLogger.error('Query embedding failed', { error });
      // 폴백: 키워드 검색
    }
  }

  // STEP 2: 검색 대상 청크 수집
  let chunksToSearch: Array<{ chunk: DocumentChunk; docNum: string }> = [];

  if (documentNumber) {
    // 특정 문서만
    const chunks = this.documents.get(documentNumber);
    if (chunks) {
      chunksToSearch = chunks.map(chunk => ({ chunk, docNum: documentNumber }));
    }

  } else {
    // 모든 문서
    for (const [docNum, chunks] of this.documents) {
      chunksToSearch.push(...chunks.map(chunk => ({ chunk, docNum })));
    }
  }

  mcpLogger.info('Chunks to search', { count: chunksToSearch.length });

  // STEP 3: 유사도 계산
  let results: Array<{ chunk: DocumentChunk; docNum: string; score: number }>;

  if (queryEmbedding) {
    // 벡터 유사도 (코사인)
    results = chunksToSearch.map(({ chunk, docNum }) => ({
      chunk,
      docNum,
      score: this.cosineSimilarity(queryEmbedding!, chunk.embedding!)
    }));

  } else {
    // 키워드 검색 (폴백)
    mcpLogger.warn('Using keyword search (no embeddings)');

    results = chunksToSearch.map(({ chunk, docNum }) => ({
      chunk,
      docNum,
      score: this.keywordSimilarity(query, chunk.text)
    }));
  }

  // STEP 4: 정렬 및 상위 K개
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, topK);

  mcpLogger.info('Search completed', {
    totalResults: results.length,
    returnedResults: topResults.length,
    topScore: topResults[0]?.score
  });

  // STEP 5: SearchResult 변환
  return topResults.map(r => ({
    text: r.chunk.text,
    score: r.score,
    metadata: r.chunk.metadata
  }));
}
```

**검색 모드**:
1. **벡터 검색** (OpenAI API 있을 때)
   - 의미적 유사도 (코사인)
   - 정확도 높음 (86%)

2. **키워드 검색** (API 없을 때)
   - 단어 매칭 기반
   - 정확도 낮음 (42%)

#### 5. cosineSimilarity() - 벡터 유사도 (Lines 342-360)

```typescript
private cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }

  // 내적 (dot product)
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  // 코사인 유사도 = dot / (||a|| * ||b||)
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**코사인 유사도**:
- 범위: -1 ~ 1 (1에 가까울수록 유사)
- 벡터 길이 무관 (방향만 비교)
- OpenAI 임베딩에 최적화

#### 6. keywordSimilarity() - 키워드 검색 (Lines 362-388)

```typescript
private keywordSimilarity(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();

  let matchCount = 0;
  let totalWeight = 0;

  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      // 단어 길이에 가중치 (긴 단어가 중요)
      const weight = term.length;
      matchCount += weight;
      totalWeight += weight;

      // 정확한 단어 매칭 보너스
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const exactMatches = (textLower.match(regex) || []).length;
      matchCount += exactMatches * weight * 0.5;
    }
    totalWeight += term.length;
  }

  return totalWeight > 0 ? matchCount / totalWeight : 0;
}
```

**키워드 검색 로직**:
1. 쿼리를 단어로 분할
2. 각 단어가 텍스트에 있는지 확인
3. 긴 단어에 높은 가중치
4. 정확한 단어 경계 매칭 보너스

---

## Services - 비즈니스 로직

### search-service.ts

**파일**: `src/services/search-service.ts` (408줄)
**역할**: 검색 요청 처리, 캐싱, 통계

**핵심 메서드**:

```typescript
async search(query: string, limit: number = 20): Promise<SearchResponse> {
  // 1. 캐시 확인
  const cacheKey = `search_${query.toLowerCase()}_${limit}`;
  const cachedResult = cacheManager.get(cacheKey);
  if (cachedResult) return cachedResult;

  // 2. 실제 검색
  await this.initializeScraper();
  const results = await this.scraper!.searchReal(query, limit);

  // 3. 캐싱 (30분)
  const searchResponse = { results, totalFound: results.length, ... };
  cacheManager.set(cacheKey, searchResponse, 1800);

  // 4. 통계 업데이트
  this.searchStats.totalSearches++;
  this.searchStats.totalResults += results.length;

  return searchResponse;
}
```

### download-service.ts

**파일**: `src/services/download-service.ts` (387줄)
**역할**: 다운로드 관리, 재시도 전략

**핵심 메서드**:

```typescript
async downloadDocumentsWithRetry(
  searchResults: any[],
  targetCount: number,
  sessionId: string,
  lastSearchQuery: string
): Promise<DownloadProgress> {
  const progress = { totalTargets: targetCount, successCount: 0, ... };

  // 목표 도달 or 최대 시도(3배) 초과까지
  while (progress.successCount < targetCount &&
         progress.attemptCount < targetCount * 3) {

    const doc = currentResults.shift();
    const result = await this.downloadSingleDocument(doc, lastSearchQuery);

    if (result.success) {
      progress.successCount++;
    }
    progress.attemptCount++;
  }

  return progress;
}
```

---

## Infrastructure - 인프라 서비스

### cache-manager.ts

**LRU 캐시 구현**:

```typescript
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private accessOrder: string[];  // LRU 순서
  private readonly maxSize = 50;

  set<T>(key: string, value: T, ttl: number): void {
    // 용량 초과 시 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey!);
    }

    this.cache.set(key, { value, timestamp: Date.now(), ttl: ttl * 1000 });
    this.accessOrder.push(key);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    // 만료 확인
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      // LRU 업데이트
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return entry.value as T;
    }

    return null;
  }
}
```

### state-manager.ts

**세션 상태 영속화**:

```typescript
export class StateManager {
  private statePath: string;
  private state: SessionState;

  async saveSearchResults(query: string, results: any[]): Promise<void> {
    this.state.searches.push({ query, results, timestamp: Date.now() });
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  async getLastSearchResults(): Promise<any[] | null> {
    const data = await fs.readFile(this.statePath, 'utf8');
    this.state = JSON.parse(data);

    if (this.state.searches.length > 0) {
      return this.state.searches[this.state.searches.length - 1].results;
    }
    return null;
  }
}
```

### pdf-cache-service.ts

**MD5 기반 캐싱**:

```typescript
export class PDFCacheService {
  async getCachedText(pdfPath: string, docNum: string): Promise<string | null> {
    // 1. MD5 해시 계산
    const fileHash = await this.calculateMD5(pdfPath);

    // 2. 캐시 확인
    const cacheEntry = this.cacheIndex.get(docNum);
    if (cacheEntry && cacheEntry.hash === fileHash) {
      // 캐시 히트 - 텍스트 로드 (0.05초)
      return await fs.readFile(`pdf-text-cache/${docNum}.txt`, 'utf8');
    }

    // 3. 캐시 미스 - PDF 추출 (30초)
    const text = await extractTextFromPDF(pdfPath);

    // 4. 캐시 저장
    await this.saveCachedText(docNum, text, fileHash);

    return text;
  }
}
```

---

## 공통 유틸리티

### utils.ts

```typescript
// 검색어 기반 폴더 경로 생성
export function createKeywordDownloadPath(query: string): string {
  const sanitized = query.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);

  const date = new Date().toISOString().split('T')[0];
  return path.join('downloaded_pdfs', `${sanitized}_${date}`);
}
// 예: "downloaded_pdfs/reactor_safety_2025-11-07/"
```

### mcp-logger.ts

```typescript
export class MCPLogger {
  info(message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data
    };

    // 파일에만 기록 (console.log 절대 사용 금지!)
    fs.appendFileSync(this.getLogFilePath(), JSON.stringify(logEntry) + '\n');
  }
}
```

---

## 개발 팁

### 새 기능 추가 시

1. **새 Tool 추가**:
   - `index.ts` → `setupHandlers()` → `tools` 배열에 정의
   - `CallToolRequestSchema` → `switch` 문에 케이스 추가
   - 새 핸들러 메서드 작성 (private async)

2. **새 Service 추가**:
   - `src/services/` 폴더에 파일 생성
   - `export` 싱글톤 인스턴스
   - `index.ts`에서 import

3. **로깅**:
   - `mcpLogger` 사용 (index.ts)
   - `logger` 사용 (adams-real-improved.ts)
   - **절대 `console.log()` 사용 금지!**

### 디버깅

1. **로그 확인**:
   ```bash
   # 최신 로그
   tail -f logs/mcp/mcp-server-*.log

   # 에러만
   grep "ERROR" logs/mcp/*.log
   ```

2. **캐시 초기화**:
   ```bash
   # 메모리 캐시는 서버 재시작
   # PDF 캐시 삭제
   rm -rf pdf-text-cache/*

   # 다운로드 파일 삭제
   rm -rf downloaded_pdfs/*
   ```

3. **빌드 확인**:
   ```bash
   npm run build
   grep "특정코드" build/index.js
   ```

---

**작성일**: 2025-11-07
**작성자**: Claude Code
**버전**: 3.0.0
