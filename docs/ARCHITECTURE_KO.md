# NRC ADAMS MCP Server - 아키텍처 문서

**버전**: 3.0.0
**최종 수정**: 2025-11-07
**상태**: Production Ready

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처 구조](#아키텍처-구조)
3. [핵심 컴포넌트](#핵심-컴포넌트)
4. [데이터 흐름](#데이터-흐름)
5. [주요 소스 파일](#주요-소스-파일)
6. [실행 순서](#실행-순서)
7. [성능 최적화](#성능-최적화)

---

## 시스템 개요

### 목적
NRC ADAMS (Agency-wide Documents Access and Management System)의 문서를 검색, 다운로드, 그리고 AI 기반 Q&A를 제공하는 MCP (Model Context Protocol) 서버입니다.

### 핵심 기능
- ✅ **실시간 ADAMS 검색**: Puppeteer 기반 웹 스크래핑
- ✅ **문서 다운로드**: PDF 자동 다운로드 및 캐싱
- ✅ **RAG 기반 Q&A**: OpenAI/Claude를 활용한 문서 질의응답
- ✅ **고성능 캐싱**: LRU 캐시 + PDF 텍스트 캐싱 (600배 속도 향상)
- ✅ **세션 상태 관리**: MCP 무상태 프로토콜의 한계 극복
- ✅ **개인정보 보호 로깅**: 파일 기반 로깅으로 MCP JSON 응답 오염 방지

### 기술 스택
```
언어: TypeScript 5.x
런타임: Node.js 18+
프로토콜: MCP (Model Context Protocol)
웹 자동화: Puppeteer 23.x
AI/ML: OpenAI API (text-embedding-ada-002), Claude API
PDF 처리: pdf-parse
HTTP 클라이언트: axios
```

---

## 아키텍처 구조

### 계층형 모듈 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Desktop (Client)                   │
│                   MCP Protocol (JSON-RPC)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Server Layer (index.ts)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  NRCADAMSMCPServer (Main Class)                      │   │
│  │  - Request Handler (ListTools, CallTool)             │   │
│  │  - Tool Registry (6 tools)                           │   │
│  │  - Response Formatting                               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│Search Service│  │Download Svc  │  │  RAG Engine  │
│              │  │              │  │   (Enhanced) │
│- ADAMS Query │  │- PDF Download│  │- Vector DB   │
│- Cache Check │  │- Retry Logic │  │- Embeddings  │
│- Statistics  │  │- Text Extract│  │- Q&A Search  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│              Infrastructure Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Cache    │  │ State    │  │PDFCache  │  │ Logger  │ │
│  │ Manager  │  │ Manager  │  │ Service  │  │ (MCP)   │ │
│  │          │  │          │  │          │  │         │ │
│  │- LRU     │  │- Session │  │- MD5     │  │- File   │ │
│  │- Memory  │  │- JSON    │  │- Compress│  │- Privacy│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  External Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ADAMS Website │  │  OpenAI API  │  │ Anthropic API │  │
│  │ (Puppeteer)  │  │ (Embeddings) │  │   (Claude)    │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 디렉토리 구조

```
eve-mcp/
├── src/                          # TypeScript 소스 코드
│   ├── index.ts                  # [901줄] MCP 서버 메인 (NRCADAMSMCPServer 클래스)
│   ├── adams-real-improved.ts    # [605줄] ADAMS 웹 스크래퍼 (Puppeteer)
│   ├── rag-engine-enhanced.ts    # [431줄] RAG 엔진 (페이지 레벨 인용)
│   ├── pdf-extractor.ts          # [189줄] PDF 텍스트 추출
│   ├── mcp-logger.ts             # [77줄] MCP 전용 로거
│   ├── logger-privacy.ts         # [440줄] 개인정보 보호 로거
│   ├── utils.ts                  # [149줄] 유틸리티 함수
│   │
│   ├── services/                 # 비즈니스 로직 서비스
│   │   ├── search-service.ts     # [408줄] 검색 서비스 (캐싱, 통계)
│   │   ├── download-service.ts   # [387줄] 다운로드 서비스 (재시도, 진행상태)
│   │   ├── cache-manager.ts      # [259줄] LRU 캐시 관리
│   │   ├── state-manager.ts      # [158줄] 세션 상태 관리 (JSON 영속성)
│   │   └── pdf-cache-service.ts  # [361줄] PDF 텍스트 캐싱 (MD5, 압축)
│   │
│   └── server/
│       └── config.ts             # [109줄] 설정 관리
│
├── build/                        # 컴파일된 JavaScript (TSC 출력)
├── downloaded_pdfs/              # PDF 다운로드 폴더 (검색어별 하위폴더)
├── pdf-text-cache/               # PDF 텍스트 캐시 (.txt 파일)
├── logs/                         # 로그 파일
│   ├── mcp/                      # MCP 서버 로그 (일별)
│   └── errors/                   # 에러 로그 (일별)
├── docs/                         # 문서
├── tests/                        # 테스트 파일 (31개)
└── scripts/                      # 유틸리티 스크립트
```

---

## 핵심 컴포넌트

### 1. MCP Server Layer (index.ts)

**역할**: MCP 프로토콜 통신 및 요청 라우팅

**주요 클래스**: `NRCADAMSMCPServer`

**핵심 코드**:
```typescript
// Line 63-94: 메인 서버 클래스
class NRCADAMSMCPServer {
  private server: Server;                    // MCP SDK 서버
  private ragEngine: EnhancedRAGEngine;      // RAG 엔진 인스턴스
  private lastSearchResults: ADAMSDocument[] = [];  // 세션 검색 결과
  private lastSearchQuery?: string;          // 마지막 검색어

  constructor() {
    // 설정 로드
    this.config = configManager.getConfig();

    // RAG 엔진 초기화
    this.ragEngine = new EnhancedRAGEngine();

    // MCP 서버 초기화
    this.server = new Server({
      name: "nrc-adams-mcp",
      version: "3.0.0"
    });

    // 핸들러 등록
    this.setupHandlers();
  }
}
```

**제공 도구** (6개):
1. `search_adams` - ADAMS 검색
2. `download_adams_documents` - 문서 다운로드
3. `ask_about_documents` - RAG Q&A
4. `list_downloaded_documents` - 다운로드 목록
5. `get_search_statistics` - 검색 통계
6. `get_download_status` - 다운로드 진행상태

**중요 특징**:
- **stdout/stderr 제어** (Line 3-21): MCP JSON 응답 오염 방지
- **세션 상태 유지** (Line 66-67): `lastSearchResults`, `lastSearchQuery`
- **에러 핸들링** (Line 96-169): 모든 요청에 try-catch 적용

---

### 2. Search Service (search-service.ts)

**역할**: ADAMS 검색 요청 처리 및 캐싱

**주요 클래스**: `SearchService`

**핵심 기능**:
```typescript
// Line 82-135: 검색 메인 로직
async search(query: string, limit: number = 20): Promise<SearchResponse> {
  const cacheKey = `search_${normalizedQuery}_${limit}`;

  // 1. 캐시 확인
  const cachedResult = cacheManager.get(cacheKey);
  if (cachedResult) {
    // 캐시 히트 - 즉시 반환
    return cachedResult;
  }

  // 2. 스크래퍼 초기화
  await this.initializeScraper();

  // 3. 실제 ADAMS 검색
  const results = await this.scraper!.searchReal(query, limit);

  // 4. 결과 캐싱 (30분)
  cacheManager.set(cacheKey, searchResponse, 1800);

  // 5. 통계 업데이트
  this.updateKeywordStats(normalizedQuery);

  return searchResponse;
}
```

**성공 키워드** (Line 44-55):
- 높은 검색 성공률을 보이는 키워드 목록
- 다운로드 재시도 시 자동 사용
- 예: "license renewal application", "safety evaluation report"

**통계 추적** (Line 35-41):
- 총 검색 횟수
- 캐시 히트율
- 평균 결과 수
- 인기 키워드

---

### 3. ADAMS Scraper (adams-real-improved.ts)

**역할**: Puppeteer를 사용한 실제 ADAMS 웹사이트 스크래핑

**주요 클래스**: `ImprovedADAMSScraper`

**핵심 로직**:
```typescript
// Line 43-53: 브라우저 초기화 (싱글톤 패턴)
async initialize() {
  if (this.browser) return;  // 이미 초기화됨

  if (this.browserInitPromise) {
    await this.browserInitPromise;  // 초기화 중 - 대기
    return;
  }

  // 새로운 초기화 시작
  this.browserInitPromise = this._initializeBrowser();
  await this.browserInitPromise;
}

// Line 55-96: 브라우저 시작 (플랫폼별 설정)
private async _initializeBrowser() {
  const isWindows = process.platform === 'win32';

  const launchOptions = {
    headless: isWindows ? false : true,  // Windows: 브라우저 표시
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // ... 안정성 플래그
    ]
  };

  // Windows: 긴 타임아웃
  launchOptions.timeout = isWindows ? 120000 : 60000;

  this.browser = await puppeteer.launch(launchOptions);
}

// Line 324-524: 실제 검색 실행
async searchReal(query: string, limit: number): Promise<RealADAMSDocument[]> {
  // 1. 브라우저 초기화
  await this.initialize();

  // 2. 새 페이지 열기
  const page = await this.browser!.newPage();

  // 3. ADAMS 검색 URL 생성
  const searchUrl = `https://adams-search.nrc.gov/results/?...`;

  // 4. 페이지 네비게이션
  await page.goto(searchUrl, {
    waitUntil: 'domcontentloaded',
    timeout: isWindows ? 90000 : 60000
  });

  // 5. 동적 콘텐츠 대기 (5-15초)
  await new Promise(resolve => setTimeout(resolve, waitTime));

  // 6. 테이블에서 문서 추출
  const tableHtml = await page.evaluate(() => {
    const table = document.querySelector('table');
    return table ? table.innerHTML : null;
  });

  // 7. Cheerio로 HTML 파싱
  const $ = cheerio.load(tableHtml);
  const documents: RealADAMSDocument[] = [];

  $('tr').each((index, row) => {
    // 각 행에서 문서 정보 추출
    const cells = $(row).find('td');
    // ... 파싱 로직
  });

  return documents;
}
```

**주요 특징**:
- **API 실패 대응**: ADAMS API는 항상 500 에러 → Puppeteer로 자동 폴백
- **플랫폼 감지**: Windows vs Mac 환경에 맞는 설정 자동 적용
- **재시도 로직** (Line 26-30): 최대 3회 시도, 지수 백오프
- **동적 대기** (Line 33-37): 페이지 로딩 시간 자동 조정

**문서 다운로드** (Line 164-260):
```typescript
async downloadPDF(accessionNumber: string, outputPath: string): Promise<boolean> {
  const url = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${accessionNumber}`;

  // Axios로 직접 다운로드 (브라우저 불필요)
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: this.DOWNLOAD_TIMEOUT
  });

  // PDF 서명 확인 (%PDF)
  const isPDF = buffer.slice(0, 4).toString() === '%PDF';

  await fs.writeFile(outputPath, buffer);
  return true;
}
```

---

### 4. RAG Engine (rag-engine-enhanced.ts)

**역할**: 벡터 임베딩 기반 문서 검색 및 Q&A

**주요 클래스**: `EnhancedRAGEngine`

**핵심 구조**:
```typescript
// Line 31-52: RAG 엔진 초기화
export class EnhancedRAGEngine {
  private documents: Map<string, DocumentChunk[]> = new Map();
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  public provider: 'openai' | 'anthropic' | 'none' = 'none';

  private readonly CHUNK_SIZE = 2000;      // 청크 크기 (성능 최적화)
  private readonly CHUNK_OVERLAP = 200;    // 청크 오버랩

  constructor() {
    // API 키 확인
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.provider = 'anthropic';
    } else {
      // API 키 없음 - 키워드 검색으로 폴백
      mcpLogger.warn('RAG: No API key found, using keyword search');
    }
  }
}
```

**문서 인덱싱** (Line 142-231):
```typescript
async indexDocument(
  filePath: string,
  documentNumber: string,
  title: string,
  content?: string
): Promise<void> {
  // 1. PDF 텍스트 추출 (캐시 또는 새로 추출)
  const text = content || await extractTextFromPDF(filePath);

  // 2. 페이지별로 분할
  const chunksWithPages = this.splitIntoChunksWithPages(text);

  // 3. DocumentChunk 객체 생성
  const documentChunks: DocumentChunk[] = [];
  for (const chunk of chunksWithPages) {
    const docChunk: DocumentChunk = {
      text: chunk.text,
      metadata: {
        documentNumber,
        title,
        filename: path.basename(filePath),
        chunkIndex: documentChunks.length,
        pageNumber: chunk.pageNumber,      // 페이지 정보
        totalPages: totalPages,
        section: this.extractSection(chunk.text),
        lineNumbers: [chunk.startLine, chunk.endLine]
      }
    };

    // 4. 임베딩 생성 (OpenAI API)
    if (this.provider === 'openai') {
      const embedding = await this.openai!.embeddings.create({
        model: 'text-embedding-ada-002',
        input: chunk.text
      });
      docChunk.embedding = embedding.data[0].embedding;
    }

    documentChunks.push(docChunk);
  }

  // 5. 메모리에 저장
  this.documents.set(documentNumber, documentChunks);
}
```

**검색 실행** (Line 253-340):
```typescript
async search(query: string, documentNumber?: string, topK: number = 5): Promise<SearchResult[]> {
  // 1. 쿼리 임베딩 생성
  let queryEmbedding: number[] | undefined;
  if (this.provider === 'openai') {
    const response = await this.openai!.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    queryEmbedding = response.data[0].embedding;
  }

  // 2. 검색 대상 문서 필터링
  let chunksToSearch: Array<{ chunk: DocumentChunk; docNum: string }> = [];

  if (documentNumber) {
    // 특정 문서만 검색
    const chunks = this.documents.get(documentNumber);
    if (chunks) {
      chunksToSearch = chunks.map(chunk => ({ chunk, docNum: documentNumber }));
    }
  } else {
    // 모든 문서 검색
    for (const [docNum, chunks] of this.documents) {
      chunksToSearch.push(...chunks.map(chunk => ({ chunk, docNum })));
    }
  }

  // 3. 유사도 계산
  if (queryEmbedding) {
    // 벡터 유사도 (코사인)
    results = chunksToSearch.map(({ chunk, docNum }) => ({
      chunk,
      docNum,
      score: this.cosineSimilarity(queryEmbedding!, chunk.embedding!)
    }));
  } else {
    // 키워드 검색 (폴백)
    results = chunksToSearch.map(({ chunk, docNum }) => ({
      chunk,
      docNum,
      score: this.keywordSimilarity(query, chunk.text)
    }));
  }

  // 4. 정렬 및 상위 K개 반환
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
```

**페이지 레벨 인용** (Line 54-141):
- PDF 페이지 번호 추적
- 섹션 제목 추출
- 라인 번호 기록
- 인용 형식: `[ML24275A095] Page 15 of 250 - Section 3.2 (Lines 450-475)`

---

### 5. Download Service (download-service.ts)

**역할**: 문서 다운로드 및 재시도 관리

**주요 기능**:
```typescript
// Line 60-137: 재시도 전략을 가진 다운로드
async downloadDocumentsWithRetry(
  searchResults: any[],
  targetCount: number,
  sessionId: string,
  lastSearchQuery: string = 'general'
): Promise<DownloadProgress> {
  const progress: DownloadProgress = {
    totalTargets: targetCount,
    successCount: 0,
    failureCount: 0,
    attemptCount: 0,
    results: []
  };

  // 목표 개수 도달 or 최대 시도 횟수(3배) 초과까지 반복
  while (progress.successCount < targetCount &&
         progress.attemptCount < targetCount * 3) {

    // 결과 소진 시 새 키워드로 재검색
    if (currentResults.length === 0) {
      const newKeyword = this.HIGH_SUCCESS_KEYWORDS[keywordIndex % ...];
      // ... 재검색 로직
      break;
    }

    // 다음 문서 다운로드 시도
    const doc = currentResults.shift();
    const result = await this.downloadSingleDocument(doc, lastSearchQuery);

    if (result.success) {
      progress.successCount++;
    } else {
      progress.failureCount++;
    }

    progress.attemptCount++;
  }

  return progress;
}
```

**단일 문서 다운로드** (Line 139-266):
```typescript
async downloadSingleDocument(
  document: any,
  lastSearchQuery: string
): Promise<DownloadResult> {
  // 1. 폴더 생성 (검색어별)
  const downloadDir = createKeywordDownloadPath(lastSearchQuery);
  await fs.mkdir(downloadDir, { recursive: true });

  // 2. 파일 경로 설정
  const filename = `${documentNumber}.pdf`;
  const filePath = path.join(downloadDir, filename);

  // 3. 이미 다운로드된 파일 확인
  if (await this.fileExists(filePath)) {
    return { success: true, filePath, ... };
  }

  // 4. Scraper로 PDF 다운로드
  await scraper.downloadPDF(accessionNumber, filePath);

  // 5. PDF 텍스트 추출
  const content = await extractTextFromPDF(filePath);

  // 6. PDF 캐시 생성 (Option A 구현)
  await pdfCacheService.getCachedText(filePath, documentNumber);

  return {
    success: true,
    filePath,
    filename,
    size: stats.size,
    content,
    metadata: { title, documentNumber, ... }
  };
}
```

**주요 특징**:
- **재시도 로직**: 실패 시 다른 문서로 자동 전환
- **진행 상태 추적**: `DownloadProgress` 객체로 실시간 모니터링
- **폴더 관리**: 검색어별 하위 폴더 생성
- **중복 방지**: 이미 다운로드된 파일 스킵

---

### 6. Infrastructure Services

#### Cache Manager (cache-manager.ts)
**역할**: LRU 메모리 캐시

```typescript
// Line 18-53: LRU 캐시 구현
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private accessOrder: string[];  // LRU 추적
  private readonly maxSize = 50;   // 최대 50개 문서

  set<T>(key: string, value: T, ttl: number = 3600): void {
    // 1. 용량 확인 - 가득 차면 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey!);
    }

    // 2. 새 항목 추가
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });

    // 3. 접근 순서 업데이트
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

#### State Manager (state-manager.ts)
**역할**: 세션 상태 영속성 (MCP 무상태 극복)

```typescript
// Line 18-79: JSON 파일 기반 상태 저장
export class StateManager {
  private statePath: string;
  private state: SessionState;

  // 검색 결과 저장
  async saveSearchResults(
    query: string,
    results: any[]
  ): Promise<void> {
    this.state.searches.push({
      query,
      results,
      timestamp: Date.now()
    });

    // JSON 파일로 저장
    await fs.writeFile(
      this.statePath,
      JSON.stringify(this.state, null, 2)
    );
  }

  // 마지막 검색 결과 로드
  async getLastSearchResults(): Promise<any[] | null> {
    // 파일에서 상태 로드
    const data = await fs.readFile(this.statePath, 'utf8');
    this.state = JSON.parse(data);

    if (this.state.searches.length > 0) {
      const lastSearch = this.state.searches[this.state.searches.length - 1];
      return lastSearch.results;
    }

    return null;
  }
}
```

**왜 필요한가?**
- MCP 프로토콜: 각 요청은 별도 프로세스
- 문제: 검색 → 다운로드 시 검색 결과 소실
- 해결: JSON 파일로 상태 영속화

#### PDF Cache Service (pdf-cache-service.ts)
**역할**: PDF 텍스트 추출 결과 캐싱 (600배 속도 향상)

```typescript
// Line 30-112: MD5 기반 캐시
export class PDFCacheService {
  private cacheDir: string;
  private indexFile: string;
  private cacheIndex: Map<string, CacheEntry>;

  async getCachedText(
    pdfPath: string,
    documentNumber: string
  ): Promise<string | null> {
    // 1. MD5 해시 계산
    const fileHash = await this.calculateMD5(pdfPath);

    // 2. 캐시 확인
    const cacheEntry = this.cacheIndex.get(documentNumber);
    if (cacheEntry && cacheEntry.hash === fileHash) {
      // 캐시 히트 - 텍스트 파일 읽기
      const cachePath = path.join(this.cacheDir, `${documentNumber}.txt`);
      return await fs.readFile(cachePath, 'utf8');
    }

    // 3. 캐시 미스 - PDF 추출
    const text = await extractTextFromPDF(pdfPath);

    // 4. 캐시 저장
    await this.saveCachedText(documentNumber, text, fileHash);

    return text;
  }

  private async calculateMD5(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }
}
```

**성능 이점**:
- 첫 추출: 30초 (587KB PDF)
- 캐시된 로드: 0.05초 (600배 빠름)
- 압축률: 18MB PDF → 587KB 텍스트 (97% 감소)

#### MCP Logger (mcp-logger.ts)
**역할**: 파일 기반 로깅 (stdout 오염 방지)

```typescript
// Line 12-77: 파일 전용 로거
export class MCPLogger {
  private logDir: string;
  private errorDir: string;

  info(message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data
    };

    // 파일에만 기록 (console.log 사용 안 함!)
    this.writeToFile(logEntry, this.getLogFilePath());
  }

  private writeToFile(entry: any, filePath: string): void {
    const logLine = JSON.stringify(entry) + '\n';

    // 동기식 파일 쓰기 (MCP 응답과 분리)
    fs.appendFileSync(filePath, logLine);
  }
}
```

**왜 파일 로깅?**
- MCP 프로토콜: stdout은 JSON 응답 전용
- `console.log()` 사용 시 → JSON 파싱 실패
- 해결: 모든 로그를 `logs/mcp/*.log` 파일로

---

## 데이터 흐름

### 1. 검색 플로우

```
[Claude Desktop]
      ↓ (MCP JSON-RPC)
      ↓ "search_adams" tool
      ↓
[index.ts: searchADAMS()]
      ↓
[searchService.search()]
      ↓
      ├─→ [cacheManager.get()] → 캐시 히트? → 즉시 반환
      │                              ↓ 미스
      ├─→ [ImprovedADAMSScraper.searchReal()]
      │         ↓
      │   [Puppeteer Browser]
      │         ↓ goto(ADAMS URL)
      │   [ADAMS Website]
      │         ↓ HTML 응답
      │   [Cheerio Parsing]
      │         ↓
      │   [RealADAMSDocument[]]
      │
      ├─→ [cacheManager.set()] → 결과 캐싱 (30분)
      │
      ├─→ [stateManager.saveSearchResults()] → JSON 저장
      │
      └─→ [SearchResponse] → Claude Desktop
```

### 2. 다운로드 플로우

```
[Claude Desktop]
      ↓ "download_adams_documents" tool
      ↓
[index.ts: downloadDocuments()]
      ↓
[stateManager.getLastSearchResults()] → 이전 검색 결과 로드
      ↓
[downloadService.downloadDocumentsWithRetry()]
      ↓
      ┌─────────────────────────────┐
      │  While (성공 < 목표)         │
      │  ↓                           │
      │  [downloadSingleDocument()]  │
      │    ↓                         │
      │    [scraper.downloadPDF()]   │
      │          ↓ GET /webSearch2   │
      │    [ADAMS Server]            │
      │          ↓ PDF binary        │
      │    [fs.writeFile()]          │
      │          ↓                   │
      │    [extractTextFromPDF()]    │
      │          ↓                   │
      │    [pdfCacheService.save()]  │
      │          ↓                   │
      │    success++                 │
      │  ↓                           │
      └─────────────────────────────┘
      ↓
[DownloadProgress] → Claude Desktop
```

### 3. Q&A 플로우

```
[Claude Desktop]
      ↓ "ask_about_documents" tool
      ↓ {question, document_number?}
      ↓
[index.ts: askAboutDocuments()]
      ↓
[loadExistingPDFs()] → 다운로드된 PDF 목록 확인
      ↓
      ┌────────────────────────────────┐
      │  For each PDF                  │
      │    ↓                            │
      │    [pdfCacheService.get()]     │  ← Option A: 자동 캐시 생성!
      │          ↓                      │
      │    [ragEngine.indexDocument()] │
      │          ↓                      │
      │          [splitIntoChunks()]   │  → 2000자 청크
      │          ↓                      │
      │          [openai.embeddings]   │  → 벡터 변환
      │          ↓                      │
      │    documents.set(docNum, [])   │  → 메모리 저장
      └────────────────────────────────┘
      ↓
[ragEngine.search(question, document_number)]
      ↓
      [openai.embeddings(question)] → 쿼리 벡터
      ↓
      [cosineSimilarity()] → 모든 청크와 비교
      ↓
      [정렬 및 상위 5개 선택]
      ↓
      [문서 필터링] → document_number로 필터 (Line 510-545 수정!)
      ↓
[응답 생성]
      ↓ {answer, citations, sources}
      ↓
[Claude Desktop]
```

---

## 주요 소스 파일

### 파일별 책임 및 핵심 코드

| 파일 | 줄 수 | 주요 책임 | 핵심 함수/클래스 |
|------|-------|----------|-----------------|
| **index.ts** | 901 | MCP 서버, 요청 라우팅 | `NRCADAMSMCPServer`, `setupHandlers()`, 6개 tool 핸들러 |
| **adams-real-improved.ts** | 605 | 웹 스크래핑, PDF 다운로드 | `ImprovedADAMSScraper`, `searchReal()`, `downloadPDF()` |
| **rag-engine-enhanced.ts** | 431 | RAG 검색, 임베딩 | `EnhancedRAGEngine`, `indexDocument()`, `search()` |
| **search-service.ts** | 408 | 검색 비즈니스 로직 | `SearchService`, `search()`, 통계 추적 |
| **download-service.ts** | 387 | 다운로드 관리 | `DownloadService`, `downloadDocumentsWithRetry()` |
| **pdf-cache-service.ts** | 361 | PDF 텍스트 캐싱 | `PDFCacheService`, `getCachedText()`, MD5 |
| **cache-manager.ts** | 259 | LRU 메모리 캐시 | `CacheManager`, `set()`, `get()` |
| **pdf-extractor.ts** | 189 | PDF 파싱 | `extractTextFromPDF()`, pdf-parse 래퍼 |
| **state-manager.ts** | 158 | 세션 영속성 | `StateManager`, `saveSearchResults()` |
| **logger-privacy.ts** | 440 | 개인정보 보호 로깅 | `measurePerformance()`, `logError()` |
| **mcp-logger.ts** | 77 | MCP 전용 로거 | `MCPLogger`, 파일 전용 로깅 |
| **utils.ts** | 149 | 유틸리티 | `createKeywordDownloadPath()` |
| **config.ts** | 109 | 설정 관리 | `ConfigManager`, 환경변수 로드 |

### 중요 함수 위치

#### index.ts
- **Line 63-94**: `NRCADAMSMCPServer` 클래스 정의
- **Line 96-169**: `setupHandlers()` - 6개 tool 등록
- **Line 185-240**: `searchADAMS()` - 검색 핸들러
- **Line 242-340**: `downloadDocuments()` - 다운로드 핸들러
- **Line 342-570**: `askAboutDocuments()` - Q&A 핸들러
  - **Line 510-545**: document_number 필터링 수정 (2025-09-30 버그 픽스)
- **Line 789-890**: `loadExistingPDFs()` - PDF 자동 로드
  - **Line 822**: Option A 구현 - 자동 캐시 생성

#### adams-real-improved.ts
- **Line 23-52**: `ImprovedADAMSScraper` 클래스
- **Line 43-53**: `initialize()` - 싱글톤 패턴
- **Line 55-96**: `_initializeBrowser()` - 플랫폼별 Puppeteer 설정
- **Line 164-260**: `downloadPDF()` - PDF 다운로드
- **Line 324-524**: `searchReal()` - ADAMS 검색 메인 로직
- **Line 340-367**: 플랫폼별 네비게이션 설정

#### rag-engine-enhanced.ts
- **Line 31-52**: `EnhancedRAGEngine` 클래스
- **Line 54-141**: `splitIntoChunksWithPages()` - 페이지 추적
- **Line 142-231**: `indexDocument()` - 문서 인덱싱
- **Line 253-340**: `search()` - RAG 검색
- **Line 342-360**: `cosineSimilarity()` - 벡터 유사도
- **Line 362-388**: `keywordSimilarity()` - 키워드 검색 (폴백)
- **Line 429-431**: `getAvailableDocuments()` - 로드된 문서 확인

#### search-service.ts
- **Line 32-66**: `SearchService` 클래스
- **Line 71-76**: `initializeScraper()` - lazy 초기화
- **Line 82-135**: `search()` - 검색 메인 로직
- **Line 137-167**: `getStatistics()` - 통계 생성

#### download-service.ts
- **Line 34-54**: `DownloadService` 클래스
- **Line 60-137**: `downloadDocumentsWithRetry()` - 재시도 전략
- **Line 139-266**: `downloadSingleDocument()` - 단일 다운로드
- **Line 268-294**: `getProgress()` - 진행 상태 조회

---

## 실행 순서

### 서버 시작 (Claude Desktop 연결 시)

```
1. Claude Desktop 시작
      ↓
2. claude_desktop_config.json 읽기
      ↓
3. node build/index.js 실행
      ↓
4. [index.ts] 모듈 로드
      ├─ dotenv.config() → .env 로드
      ├─ stdout/stderr 제어 설정
      ├─ Service 임포트 (search, download, cache, state, pdfCache)
      └─ EnhancedRAGEngine 임포트
      ↓
5. [index.ts:70-94] NRCADAMSMCPServer 생성
      ├─ configManager.getConfig()
      ├─ new EnhancedRAGEngine()
      │     ├─ OpenAI 초기화 (API 키 확인)
      │     └─ "RAG: OpenAI provider initialized" 로그
      ├─ pdfCacheService.initialize()
      │     └─ "PDFCacheService initialized" 로그
      └─ new Server({ name: "nrc-adams-mcp", version: "3.0.0" })
      ↓
6. [index.ts:93] setupHandlers() 실행
      ├─ ListToolsRequestSchema 핸들러 등록
      └─ CallToolRequestSchema 핸들러 등록
      ↓
7. [index.ts:899] server.connect()
      ↓
8. "NRC ADAMS MCP Server (Modular v3.0) started successfully" 로그
      ↓
9. Claude Desktop에서 도구 사용 가능 상태
```

### 검색 요청 처리

```
1. 사용자: "Search ADAMS for reactor safety"
      ↓
2. Claude Desktop → MCP JSON-RPC 요청
      {
        "method": "tools/call",
        "params": {
          "name": "search_adams",
          "arguments": {
            "query": "reactor safety",
            "max_results": 20
          }
        }
      }
      ↓
3. [index.ts:169] CallToolRequestSchema 핸들러
      ↓
4. [index.ts:185-240] searchADAMS() 함수
      ├─ 입력 검증
      ├─ mcpLogger.info("ADAMS search initiated")
      └─ searchService.search(query, max_results)
      ↓
5. [search-service.ts:82-135] search() 함수
      ├─ 캐시 키 생성: "search_reactor safety_20"
      ├─ cacheManager.get(cacheKey)
      │     └─ 캐시 미스 → null
      ├─ initializeScraper()
      │     ├─ new ImprovedADAMSScraper()
      │     └─ scraper.initialize()
      │           └─ [adams-real-improved.ts:43-96] 브라우저 시작
      └─ scraper.searchReal("reactor safety", 20)
      ↓
6. [adams-real-improved.ts:324-524] searchReal() 함수
      ├─ browser.newPage()
      ├─ page.goto("https://adams-search.nrc.gov/results/...")
      ├─ 대기 (5-15초)
      ├─ page.evaluate() → HTML 추출
      ├─ Cheerio로 테이블 파싱
      ├─ 문서 목록 생성: RealADAMSDocument[]
      └─ return documents
      ↓
7. [search-service.ts:110-135] 결과 처리
      ├─ cacheManager.set(cacheKey, results, 1800) → 30분 캐싱
      ├─ updateKeywordStats(query)
      └─ return SearchResponse
      ↓
8. [index.ts:185-240] searchADAMS() 계속
      ├─ lastSearchResults = results → 메모리 저장
      ├─ lastSearchQuery = query → 메모리 저장
      ├─ stateManager.saveSearchResults(query, results) → JSON 저장
      └─ return { content: [{ type: "text", text: "..." }] }
      ↓
9. MCP JSON-RPC 응답 → Claude Desktop
      ↓
10. 사용자에게 검색 결과 표시
```

### 다운로드 요청 처리

```
1. 사용자: "Download 5 documents"
      ↓
2. [index.ts:242-340] downloadDocuments() 호출
      ├─ stateManager.getLastSearchResults()
      │     └─ JSON 파일에서 이전 검색 결과 로드
      ├─ downloadService.downloadDocumentsWithRetry(results, 5, sessionId, query)
      └─ ...
      ↓
3. [download-service.ts:60-137] downloadDocumentsWithRetry()
      ├─ progress = { totalTargets: 5, successCount: 0, ... }
      └─ while (successCount < 5 && attemptCount < 15)
            ↓
4. [download-service.ts:139-266] downloadSingleDocument() (반복)
      ├─ createKeywordDownloadPath("reactor safety")
      │     └─ "downloaded_pdfs/reactor_safety_2025-11-07/"
      ├─ fs.mkdir(downloadDir)
      ├─ filePath = "downloaded_pdfs/.../ML12305A252.pdf"
      ├─ fileExists(filePath)? → 스킵
      ├─ scraper.downloadPDF(accessionNumber, filePath)
      │     └─ [adams-real-improved.ts:164-260] PDF 다운로드
      ├─ extractTextFromPDF(filePath) → 텍스트 추출
      ├─ pdfCacheService.getCachedText(filePath, docNum)
      │     └─ [pdf-cache-service.ts:54-112] 캐시 생성
      └─ return { success: true, filePath, content, ... }
      ↓
5. progress.successCount++ → 5에 도달하면 종료
      ↓
6. [index.ts:242-340] downloadDocuments() 계속
      └─ return { content: [{ type: "text", text: "Downloaded 5/5..." }] }
      ↓
7. MCP 응답 → Claude Desktop
      ↓
8. 사용자에게 다운로드 완료 알림
```

### Q&A 요청 처리

```
1. 사용자: "What are the safety requirements in ML12305A252?"
      ↓
2. [index.ts:342-570] askAboutDocuments() 호출
      ├─ question = "What are the safety requirements..."
      ├─ document_number = "ML12305A252"
      └─ ...
      ↓
3. [index.ts:789-890] loadExistingPDFs() 호출
      ├─ glob("downloaded_pdfs/**/*.pdf")
      └─ for each PDF:
            ├─ pdfPath = "downloaded_pdfs/.../ML12305A252.pdf"
            ├─ pdfCacheService.getCachedText(pdfPath, docNum) ← Option A!
            │     ├─ 캐시 없음 → extractTextFromPDF() 실행 (30초)
            │     └─ 캐시 저장 → 다음번 0.05초
            ├─ ragEngine.indexDocument(pdfPath, docNum, title, content)
            │     └─ [rag-engine-enhanced.ts:142-231] 인덱싱
            │           ├─ splitIntoChunksWithPages(content)
            │           ├─ for each chunk:
            │           │     ├─ openai.embeddings.create() → 벡터
            │           │     └─ documents.set(docNum, chunks[])
            │           └─ "Indexed 1 document with 19 chunks" 로그
            └─ documentsIndexed++
      ↓
4. [index.ts:342-570] askAboutDocuments() 계속
      ├─ ragEngine.search(question, document_number, 5)
      │     └─ [rag-engine-enhanced.ts:253-340] RAG 검색
      │           ├─ openai.embeddings.create(question) → 쿼리 벡터
      │           ├─ documents.get(document_number) → 특정 문서만
      │           ├─ cosineSimilarity(queryVec, chunkVec) → 유사도
      │           ├─ 정렬 후 상위 5개 선택
      │           └─ return SearchResult[]
      ├─ 문서 번호로 필터링 (Line 510-545) ← 2025-09-30 버그 픽스!
      │     └─ results.filter(r => r.metadata.documentNumber === "ML12305A252")
      ├─ 답변 생성 (인용 포함)
      │     └─ "[ML12305A252] Page 15 of 250 - Section 3.2 (Lines 450-475)"
      └─ return { content: [{ type: "text", text: "..." }] }
      ↓
5. MCP 응답 → Claude Desktop
      ↓
6. 사용자에게 답변 및 인용 표시
```

---

## 성능 최적화

### 1. PDF 텍스트 캐싱 (600배 향상)

**문제**:
- PDF 추출: 30초 (587KB 텍스트)
- Q&A 때마다 재추출 → 사용자 경험 저하

**해결** (pdf-cache-service.ts):
```typescript
// MD5 기반 캐시 무효화
async getCachedText(pdfPath: string, docNum: string): Promise<string | null> {
  const fileHash = await this.calculateMD5(pdfPath);
  const cacheEntry = this.cacheIndex.get(docNum);

  if (cacheEntry && cacheEntry.hash === fileHash) {
    // 캐시 히트 - 텍스트 파일 읽기 (0.05초)
    return await fs.readFile(`pdf-text-cache/${docNum}.txt`, 'utf8');
  }

  // 캐시 미스 - 추출 후 저장 (30초)
  const text = await extractTextFromPDF(pdfPath);
  await this.saveCachedText(docNum, text, fileHash);
  return text;
}
```

**결과**:
- 첫 Q&A: 30초 (추출 + 인덱싱)
- 이후 Q&A: 0.05초 (캐시 로드)
- **600배 속도 향상**

### 2. RAG 청크 크기 최적화

**문제**:
- 500자 청크: 587KB → 1137개 임베딩 → 45초
- OpenAI API 병목

**해결** (rag-engine-enhanced.ts:36-37):
```typescript
private readonly CHUNK_SIZE = 2000;      // 500 → 2000 (4배)
private readonly CHUNK_OVERLAP = 200;    // 50 → 200 (4배)
```

**결과**:
- 2000자 청크: 587KB → 284개 임베딩 → 20초
- **임베딩 75% 감소, 속도 2.25배 향상**

### 3. LRU 캐시 (검색 결과)

**구현** (cache-manager.ts):
```typescript
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private readonly maxSize = 50;   // 최대 50개 문서

  set(key: string, value: any, ttl: number = 3600): void {
    // 용량 초과 시 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey!);
    }
    // ... 새 항목 추가
  }
}
```

**효과**:
- 동일 검색: 12초 → 0.001초 (즉시 반환)
- 캐시 히트율: 40-60%

### 4. 세션 상태 영속화 (다운로드 성공률)

**문제**:
- MCP: 각 요청 = 새 프로세스
- 검색 → 다운로드 시 결과 소실 → 0% 성공률

**해결** (state-manager.ts):
```typescript
// 검색 후
await stateManager.saveSearchResults(query, results);
// → logs/session-state.json에 저장

// 다운로드 시
const results = await stateManager.getLastSearchResults();
// → JSON 파일에서 로드
```

**결과**:
- 다운로드 성공률: 0% → 100%

### 5. Puppeteer 플랫폼 최적화

**Mac 설정** (adams-real-improved.ts:63):
```typescript
headless: true,           // 백그라운드 실행
timeout: 60000,           // 60초
waitTime: 2000            // 2초 대기
```

**Windows 설정** (adams-real-improved.ts:63):
```typescript
headless: false,          // 브라우저 표시 (안정성)
timeout: 120000,          // 120초 (2배)
waitTime: 5000            // 5초 대기 (2.5배)
```

**결과**:
- Mac: 12초 검색, 25개 문서
- Windows: (현재 디버깅 중)

---

## 배포 체크리스트

### 빌드 전
- [ ] TypeScript 컴파일 에러 없음
- [ ] 모든 import 경로 확인 (.js 확장자!)
- [ ] .env 파일 준비 (OPENAI_API_KEY)

### 빌드
```bash
npm run build
# → build/ 폴더에 JavaScript 생성
```

### Claude Desktop 설정
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/full/path/to/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  },
  "networkAccess": {
    "allowedDomains": [
      "adams.nrc.gov",
      "adams-search.nrc.gov",
      "adamswebsearch2.nrc.gov"
    ]
  }
}
```

### 테스트
- [ ] 검색 테스트 (search_adams)
- [ ] 다운로드 테스트 (download_adams_documents)
- [ ] Q&A 테스트 (ask_about_documents)
- [ ] 통계 확인 (get_search_statistics)
- [ ] 로그 파일 확인 (logs/mcp/*.log)

### 모니터링
- 로그 위치: `logs/mcp/mcp-server-YYYY-MM-DD.log`
- 캐시 위치: `pdf-text-cache/*.txt`
- 다운로드: `downloaded_pdfs/검색어_날짜/*.pdf`

---

## 다음 단계

### 개발 중인 기능
- [ ] Windows Puppeteer 안정화 (fix/windows-puppeteer-v3 브랜치)
- [ ] 다중 문서 비교 Q&A
- [ ] 자동 문서 분류 (NUREG, SECY 등)

### 성능 개선 계획
- [ ] Playwright 전환 검토 (Puppeteer 대체)
- [ ] Redis 캐시 고려 (분산 환경)
- [ ] 병렬 다운로드 (Promise.all)

### 문서화
- [x] 아키텍처 문서 (이 문서)
- [ ] API 문서 (각 tool 상세)
- [ ] 트러블슈팅 가이드 확장

---

**문서 작성**: 2025-11-07
**최종 검토**: Kelly
**버전**: 3.0.0
