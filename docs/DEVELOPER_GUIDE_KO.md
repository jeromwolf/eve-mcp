# 개발자 가이드

**버전**: 3.0.0
**최종 수정**: 2025-11-07

---

## 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [프로젝트 구조 이해](#프로젝트-구조-이해)
3. [일반적인 개발 작업](#일반적인-개발-작업)
4. [디버깅 가이드](#디버깅-가이드)
5. [성능 최적화](#성능-최적화)
6. [트러블슈팅](#트러블슈팅)
7. [기여 가이드](#기여-가이드)

---

## 개발 환경 설정

### 필수 요구사항

```bash
# Node.js 18+ (LTS 권장)
node --version  # v18.0.0 이상

# npm 9+
npm --version   # v9.0.0 이상

# TypeScript (global 설치 권장)
npm install -g typescript

# Git
git --version   # 2.0 이상
```

### 프로젝트 클론 및 설치

```bash
# 1. 저장소 클론
git clone https://github.com/jeromwolf/eve-mcp.git
cd eve-mcp

# 2. 의존성 설치
npm install

# 3. .env 파일 생성
cat > .env << EOF
OPENAI_API_KEY=sk-your-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-api-key-here  # 선택사항
EOF

# 4. TypeScript 빌드
npm run build

# 5. 테스트 실행
node test-simple.js
```

### IDE 설정 (VS Code 권장)

**.vscode/settings.json**:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**추천 확장**:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Error Lens (에러 실시간 표시)

### 브랜치 전략

```bash
# main: 안정 버전
# develop: 개발 중인 기능
# fix/*: 버그 수정
# feature/*: 새 기능

# 예시
git checkout -b feature/multi-document-qa
git checkout -b fix/windows-puppeteer-v3
```

---

## 프로젝트 구조 이해

### 핵심 파일 위치

```
eve-mcp/
├── src/                          # 소스 코드 (TypeScript)
│   ├── index.ts                  # MCP 서버 진입점 ⭐
│   ├── adams-real-improved.ts    # ADAMS 스크래퍼 ⭐
│   ├── rag-engine-enhanced.ts    # RAG 엔진 ⭐
│   │
│   ├── services/                 # 비즈니스 로직
│   │   ├── search-service.ts     # 검색 관리
│   │   ├── download-service.ts   # 다운로드 관리
│   │   ├── cache-manager.ts      # LRU 캐시
│   │   ├── state-manager.ts      # 세션 상태
│   │   └── pdf-cache-service.ts  # PDF 캐싱
│   │
│   ├── server/
│   │   └── config.ts             # 환경 설정
│   │
│   ├── mcp-logger.ts             # MCP 전용 로거
│   ├── logger-privacy.ts         # 개인정보 보호 로거
│   ├── pdf-extractor.ts          # PDF 파싱
│   └── utils.ts                  # 유틸리티
│
├── build/                        # 컴파일된 JavaScript
├── docs/                         # 문서
│   ├── ARCHITECTURE_KO.md        # 아키텍처 설명
│   ├── SOURCE_CODE_GUIDE_KO.md   # 소스 코드 가이드
│   └── DEVELOPER_GUIDE_KO.md     # 이 문서
│
├── tests/                        # 테스트 스크립트
├── downloaded_pdfs/              # PDF 다운로드
├── pdf-text-cache/               # PDF 텍스트 캐시
├── logs/                         # 로그 파일
│   ├── mcp/                      # MCP 서버 로그
│   └── errors/                   # 에러 로그
│
├── package.json                  # 의존성 관리
├── tsconfig.json                 # TypeScript 설정
└── .env                          # 환경 변수 (gitignore)
```

### 모듈 의존성 그래프

```
index.ts (MCP Server)
  ├─→ search-service.ts
  │     └─→ adams-real-improved.ts
  │           └─→ puppeteer
  │
  ├─→ download-service.ts
  │     ├─→ adams-real-improved.ts
  │     ├─→ pdf-extractor.ts
  │     └─→ pdf-cache-service.ts
  │
  ├─→ rag-engine-enhanced.ts
  │     ├─→ openai (embeddings)
  │     └─→ anthropic (optional)
  │
  ├─→ cache-manager.ts (LRU)
  ├─→ state-manager.ts (JSON)
  └─→ mcp-logger.ts (파일 로깅)
```

---

## 일반적인 개발 작업

### 1. 새 Tool 추가하기

**예시**: "get_document_metadata" tool 추가

#### Step 1: Tool 정의 (index.ts)

```typescript
// Line 96-169: setupHandlers() 함수 내부

private setupHandlers(): void {
  this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // ... 기존 tool들
      {
        name: "get_document_metadata",
        description: "문서의 메타데이터 (작성자, 날짜, 페이지 수 등) 조회",
        inputSchema: {
          type: "object",
          properties: {
            document_number: {
              type: "string",
              description: "문서 번호 (예: ML12305A252)"
            }
          },
          required: ["document_number"]
        }
      }
    ]
  }));

  // Tool 실행 핸들러
  this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      // ... 기존 case들
      case "get_document_metadata":
        return await this.getDocumentMetadata(args.document_number);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });
}
```

#### Step 2: 핸들러 구현 (index.ts)

```typescript
// index.ts 하단에 추가

private async getDocumentMetadata(documentNumber: string) {
  try {
    mcpLogger.info('Getting document metadata', { documentNumber });

    // 1. PDF 파일 찾기
    const pdfPath = await this.findPdfPath(documentNumber);

    if (!pdfPath) {
      return {
        content: [{
          type: "text",
          text: `문서 ${documentNumber}를 찾을 수 없습니다.`
        }]
      };
    }

    // 2. 메타데이터 추출
    const stats = await fs.stat(pdfPath);
    const text = await pdfCacheService.getCachedText(pdfPath, documentNumber);
    const pageCount = this.estimatePages(text);

    // 3. 응답 생성
    const metadata = {
      documentNumber,
      filePath: pdfPath,
      fileSize: `${Math.round(stats.size / 1024)} KB`,
      textLength: `${Math.round(text.length / 1024)} KB`,
      estimatedPages: pageCount,
      lastModified: stats.mtime.toISOString()
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(metadata, null, 2)
      }]
    };

  } catch (error) {
    mcpLogger.error('Failed to get metadata', { documentNumber, error });
    throw new McpError(
      ErrorCode.InternalError,
      `메타데이터 조회 실패: ${error.message}`
    );
  }
}

// 헬퍼 함수
private async findPdfPath(documentNumber: string): Promise<string | null> {
  const pattern = path.join(
    path.resolve(__dirname, '..'),
    'downloaded_pdfs',
    '**',
    `${documentNumber}.pdf`
  );

  const files = await glob(pattern);
  return files.length > 0 ? files[0] : null;
}

private estimatePages(text: string): number {
  const avgCharsPerPage = 2000;
  return Math.ceil(text.length / avgCharsPerPage);
}
```

#### Step 3: 테스트

```bash
# 빌드
npm run build

# Claude Desktop 재시작

# 테스트
# Claude Desktop에서:
# "Get metadata for document ML12305A252"
```

### 2. 새 Service 추가하기

**예시**: "citation-service.ts" 추가

#### Step 1: Service 파일 생성

```typescript
// src/services/citation-service.ts

import mcpLogger from '../mcp-logger.js';

interface Citation {
  documentNumber: string;
  pageNumber: number;
  section?: string;
  quote: string;
}

export class CitationService {
  private citations: Map<string, Citation[]> = new Map();

  addCitation(
    sessionId: string,
    documentNumber: string,
    pageNumber: number,
    quote: string,
    section?: string
  ): void {
    const citation: Citation = {
      documentNumber,
      pageNumber,
      section,
      quote
    };

    if (!this.citations.has(sessionId)) {
      this.citations.set(sessionId, []);
    }

    this.citations.get(sessionId)!.push(citation);

    mcpLogger.info('Citation added', {
      sessionId,
      documentNumber,
      pageNumber
    });
  }

  getCitations(sessionId: string): Citation[] {
    return this.citations.get(sessionId) || [];
  }

  clearCitations(sessionId: string): void {
    this.citations.delete(sessionId);
    mcpLogger.info('Citations cleared', { sessionId });
  }

  exportCitations(sessionId: string, format: 'json' | 'markdown'): string {
    const citations = this.getCitations(sessionId);

    if (format === 'json') {
      return JSON.stringify(citations, null, 2);
    }

    // Markdown 형식
    let markdown = '# Citations\n\n';
    citations.forEach((c, index) => {
      markdown += `${index + 1}. [${c.documentNumber}] Page ${c.pageNumber}`;
      if (c.section) {
        markdown += ` - ${c.section}`;
      }
      markdown += `\n   > ${c.quote}\n\n`;
    });

    return markdown;
  }
}

// 싱글톤 export
export const citationService = new CitationService();
```

#### Step 2: index.ts에 통합

```typescript
// index.ts 상단
import { citationService } from './services/citation-service.js';

// askAboutDocuments() 내부 (RAG 검색 후)
private async askAboutDocuments(question: string, documentNumber?: string) {
  // ... 기존 코드

  // 검색 결과를 citation으로 저장
  const sessionId = 'current-session'; // 실제로는 고유 ID 생성

  for (const result of filteredResults) {
    citationService.addCitation(
      sessionId,
      result.metadata.documentNumber,
      result.metadata.pageNumber || 1,
      result.text.substring(0, 200), // 처음 200자
      result.metadata.section
    );
  }

  // ... 응답 생성
}
```

### 3. 로깅 추가하기

**중요**: MCP 프로토콜에서는 `console.log()` 사용 금지!

#### 올바른 로깅 방법

```typescript
// index.ts 또는 services/
import mcpLogger from './mcp-logger.js';

// 정보 로그
mcpLogger.info('Search started', {
  query: 'reactor safety',
  limit: 20
});

// 경고 로그
mcpLogger.warn('Cache miss', {
  cacheKey: 'search_reactor_safety_20'
});

// 에러 로그
mcpLogger.error('Download failed', {
  documentNumber: 'ML12305A252',
  error: error.message,
  stack: error.stack
});
```

#### 로그 확인

```bash
# 실시간 로그
tail -f logs/mcp/mcp-server-$(date +%Y-%m-%d).log

# 에러만
grep "ERROR" logs/mcp/*.log

# 특정 문서 관련
grep "ML12305A252" logs/mcp/*.log
```

### 4. 캐싱 추가하기

**예시**: 메타데이터 캐싱

```typescript
// cache-manager.ts 사용

import { cacheManager } from './services/cache-manager.js';

async function getDocumentMetadata(documentNumber: string) {
  // 1. 캐시 확인
  const cacheKey = `metadata_${documentNumber}`;
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    mcpLogger.info('Metadata from cache', { documentNumber });
    return cached;
  }

  // 2. 실제 추출
  const metadata = await extractMetadata(documentNumber);

  // 3. 캐싱 (1시간 = 3600초)
  cacheManager.set(cacheKey, metadata, 3600);

  return metadata;
}
```

---

## 디버깅 가이드

### 1. MCP 통신 디버깅

**문제**: Tool 호출이 안 됨

```bash
# 1. MCP 프로토콜 테스트
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js

# 정상 응답:
# {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}

# 2. Tool 실행 테스트
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_adams","arguments":{"query":"test"}},"id":2}' | node build/index.js
```

**문제**: JSON 파싱 에러

```bash
# 원인: console.log() 사용
# 해결: 모든 console.log()를 mcpLogger로 교체

# 검색
grep -r "console.log" src/

# 교체
sed -i 's/console.log/mcpLogger.info/g' src/index.ts
```

### 2. Puppeteer 디버깅

**브라우저 화면 보기**:

```typescript
// adams-real-improved.ts
const launchOptions = {
  headless: false,  // 브라우저 표시
  devtools: true,   // DevTools 자동 열기
  slowMo: 100       // 액션 느리게 (ms)
};
```

**스크린샷 저장**:

```typescript
// searchReal() 내부
await page.screenshot({ path: 'debug-screenshot.png' });
```

**HTML 저장**:

```typescript
const html = await page.content();
await fs.writeFile('debug-page.html', html);
```

### 3. RAG 디버깅

**임베딩 확인**:

```typescript
// rag-engine-enhanced.ts
async indexDocument(...) {
  // ... 기존 코드

  mcpLogger.info('Embedding statistics', {
    documentNumber,
    totalChunks: documentChunks.length,
    withEmbeddings: documentChunks.filter(c => c.embedding).length,
    firstEmbeddingLength: documentChunks[0]?.embedding?.length
  });
}
```

**검색 결과 분석**:

```typescript
async search(query: string, ...) {
  // ... 검색 실행

  mcpLogger.info('Search result details', {
    query,
    topScores: topResults.map(r => ({
      score: r.score,
      docNum: r.metadata.documentNumber,
      page: r.metadata.pageNumber
    }))
  });
}
```

### 4. 성능 프로파일링

**시간 측정**:

```typescript
// logger-privacy.ts 사용
import { measurePerformance } from './logger-privacy.js';

async function someOperation() {
  const perf = measurePerformance('Operation name');

  try {
    // ... 작업 수행
    perf.end(true);  // 성공

  } catch (error) {
    perf.end(false); // 실패
    throw error;
  }
}
```

**메모리 사용량**:

```typescript
mcpLogger.info('Memory usage', {
  heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
  rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
});
```

---

## 성능 최적화

### 1. PDF 텍스트 캐싱 최적화

**현재**: MD5 해시 기반

**개선 방안**:

```typescript
// pdf-cache-service.ts

// 파일 크기 + 수정 시간으로 빠른 검증
async getCachedText(pdfPath: string, docNum: string): Promise<string | null> {
  const cacheEntry = this.cacheIndex.get(docNum);

  if (cacheEntry) {
    const stats = await fs.stat(pdfPath);

    // 빠른 검증 (MD5 계산 생략)
    if (stats.size === cacheEntry.size &&
        stats.mtime.getTime() === cacheEntry.mtime) {
      return await fs.readFile(this.getCachePath(docNum), 'utf8');
    }
  }

  // 캐시 미스 - 추출
  const text = await extractTextFromPDF(pdfPath);
  await this.saveCachedText(docNum, text, pdfPath);
  return text;
}
```

### 2. RAG 검색 병렬화

**현재**: 순차 임베딩

**개선**:

```typescript
// rag-engine-enhanced.ts

async indexDocument(...) {
  // 청크를 배치로 처리 (한 번에 10개)
  const BATCH_SIZE = 10;
  const batches = [];

  for (let i = 0; i < chunksWithPages.length; i += BATCH_SIZE) {
    batches.push(chunksWithPages.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    // 병렬 임베딩
    const embeddings = await Promise.all(
      batch.map(chunk =>
        this.openai!.embeddings.create({
          model: 'text-embedding-ada-002',
          input: chunk.text
        })
      )
    );

    // DocumentChunk 생성
    batch.forEach((chunk, index) => {
      documentChunks.push({
        text: chunk.text,
        embedding: embeddings[index].data[0].embedding,
        metadata: { ... }
      });
    });
  }
}
```

### 3. LRU 캐시 크기 동적 조정

```typescript
// cache-manager.ts

export class CacheManager {
  private maxSize: number;

  constructor() {
    // 시스템 메모리에 따라 동적 조정
    const totalMem = os.totalmem();
    this.maxSize = totalMem > 16 * 1024 * 1024 * 1024 ? 100 : 50;
  }
}
```

---

## 트러블슈팅

### 문제 1: "0 documents indexed"

**증상**: Q&A 실행 시 문서가 인덱싱되지 않음

**원인**:
1. PDF 다운로드 안 됨
2. PDF 텍스트 캐시 생성 안 됨
3. `loadExistingPDFs()` 실패

**해결**:

```bash
# 1. PDF 파일 확인
ls -lh downloaded_pdfs/*/*.pdf

# 2. 캐시 파일 확인
ls -lh pdf-text-cache/*.txt

# 3. 로그 확인
grep "indexed" logs/mcp/mcp-server-*.log
```

**수동 캐시 생성**:

```bash
node -e "
import('./build/services/pdf-cache-service.js').then(async m => {
  const service = m.pdfCacheService;
  await service.initialize();
  const text = await service.getCachedText(
    'downloaded_pdfs/.../ML12305A252.pdf',
    'ML12305A252'
  );
  console.log('Cached:', text.length, 'chars');
});
"
```

### 문제 2: Windows Puppeteer 실패

**증상**: 검색 결과 0건

**디버깅 체크리스트**:

```bash
# 1. 플랫폼 확인
node -e "console.log(process.platform)"  # win32

# 2. Chrome 경로 확인
where chrome.exe

# 3. 환경 변수 설정
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# 4. 헤드리스 모드 끄기 (src/adams-real-improved.ts)
headless: false

# 5. 긴 타임아웃
timeout: 120000

# 6. 로그 확인
type logs\mcp\mcp-server-*.log | findstr "Browser"
```

### 문제 3: OpenAI API 오류

**증상**: "401 Unauthorized" 또는 "Rate limit exceeded"

**해결**:

```bash
# 1. API 키 확인
echo $OPENAI_API_KEY

# 2. 키 유효성 테스트
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 3. Rate limit 확인
# OpenAI 대시보드: https://platform.openai.com/usage

# 4. Fallback to keyword search
# .env에서 OPENAI_API_KEY 제거 → 키워드 검색으로 자동 전환
```

### 문제 4: 메모리 부족

**증상**: "JavaScript heap out of memory"

**해결**:

```bash
# Node.js 힙 크기 증가
NODE_OPTIONS="--max-old-space-size=4096" node build/index.js

# Claude Desktop 설정에 추가
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["--max-old-space-size=4096", "/path/to/build/index.js"],
      ...
    }
  }
}
```

**근본 원인 찾기**:

```typescript
// 메모리 프로파일링
setInterval(() => {
  const usage = process.memoryUsage();
  mcpLogger.info('Memory snapshot', {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    documentsInRAG: ragEngine.documents.size
  });
}, 60000); // 1분마다
```

---

## 기여 가이드

### Pull Request 절차

1. **이슈 생성**:
   ```
   GitHub Issues에 버그 리포트 또는 기능 제안
   ```

2. **브랜치 생성**:
   ```bash
   git checkout -b fix/issue-123-windows-search
   ```

3. **코드 작성 및 테스트**:
   ```bash
   npm run build
   node tests/test-simple.js
   ```

4. **커밋**:
   ```bash
   git add .
   git commit -m "fix: Resolve Windows Puppeteer timeout issue

   - Increased timeout from 60s to 120s on Windows
   - Added platform-specific User-Agent
   - Disabled headless mode for stability

   Fixes #123"
   ```

5. **푸시 및 PR**:
   ```bash
   git push origin fix/issue-123-windows-search
   # GitHub에서 Pull Request 생성
   ```

### 코드 스타일

```typescript
// 1. 함수명: camelCase
async function searchADAMS() {}

// 2. 클래스명: PascalCase
class SearchService {}

// 3. 상수: UPPER_SNAKE_CASE
const MAX_RESULTS = 50;

// 4. 파일명: kebab-case
// search-service.ts
// pdf-cache-service.ts

// 5. 비동기 함수: async/await (Promise.then() 지양)
async function getData() {
  const result = await fetch();
  return result;
}

// 6. 에러 핸들링: try-catch + 로깅
try {
  await riskyOperation();
} catch (error) {
  mcpLogger.error('Operation failed', { error });
  throw error;
}
```

### 커밋 메시지 규칙

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 리팩토링
- `perf`: 성능 개선
- `test`: 테스트 추가
- `chore`: 빌드/설정 변경

**예시**:
```
feat(rag): Add multi-document comparison Q&A

- Implemented cross-document similarity search
- Added citation merging from multiple sources
- Enhanced page-level citation format

Closes #145
```

### 테스트 작성

**단위 테스트** (tests/unit/):
```typescript
// tests/unit/cache-manager.test.ts
import { CacheManager } from '../../src/services/cache-manager.js';

describe('CacheManager', () => {
  it('should cache and retrieve values', () => {
    const manager = new CacheManager();
    manager.set('key1', 'value1', 60);

    const result = manager.get('key1');
    expect(result).toBe('value1');
  });

  it('should evict oldest item when full', () => {
    const manager = new CacheManager();
    // ... LRU 테스트
  });
});
```

**통합 테스트** (tests/integration/):
```typescript
// tests/integration/search-download.test.ts
describe('Search and Download Flow', () => {
  it('should search and download documents', async () => {
    const results = await searchService.search('reactor safety', 5);
    expect(results.totalFound).toBeGreaterThan(0);

    const progress = await downloadService.downloadDocumentsWithRetry(
      results.results, 3, 'test-session', 'reactor safety'
    );
    expect(progress.successCount).toBe(3);
  });
});
```

---

## 유용한 스크립트

### 1. 전체 재빌드 및 테스트

```bash
#!/bin/bash
# scripts/rebuild-test.sh

echo "🧹 Cleaning..."
rm -rf build/
rm -rf node_modules/

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "✅ Testing..."
node tests/test-simple.js

echo "🎉 Done!"
```

### 2. 로그 분석

```bash
#!/bin/bash
# scripts/analyze-logs.sh

LOG_DIR="logs/mcp"
LATEST_LOG=$(ls -t $LOG_DIR/*.log | head -1)

echo "📊 Log Analysis: $LATEST_LOG"
echo ""

echo "Total searches:"
grep "ADAMS search initiated" $LATEST_LOG | wc -l

echo "Cache hit rate:"
TOTAL=$(grep "Starting ADAMS search" $LATEST_LOG | wc -l)
HITS=$(grep "Search result from cache" $LATEST_LOG | wc -l)
echo "scale=2; $HITS * 100 / $TOTAL" | bc

echo "Average search time:"
grep "searchTime" $LATEST_LOG | \
  grep -oP '"searchTime":\d+' | \
  cut -d: -f2 | \
  awk '{sum+=$1; count++} END {print sum/count " ms"}'

echo "Errors:"
grep "ERROR" $LATEST_LOG | wc -l
```

### 3. 캐시 정리

```bash
#!/bin/bash
# scripts/clean-cache.sh

echo "🧹 Cleaning caches..."

# PDF 텍스트 캐시
rm -rf pdf-text-cache/*
echo "✅ PDF cache cleared"

# 다운로드 파일 (선택적)
read -p "Delete downloaded PDFs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf downloaded_pdfs/*
  echo "✅ Downloads cleared"
fi

# 로그 (7일 이상 된 것만)
find logs/ -name "*.log" -mtime +7 -delete
echo "✅ Old logs cleared"

echo "🎉 Done!"
```

---

## 참고 자료

### 내부 문서
- [ARCHITECTURE_KO.md](./ARCHITECTURE_KO.md) - 시스템 아키텍처
- [SOURCE_CODE_GUIDE_KO.md](./SOURCE_CODE_GUIDE_KO.md) - 소스 코드 상세
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 문제 해결
- [QUICK_START_KO.md](./QUICK_START_KO.md) - 빠른 시작

### 외부 문서
- [MCP Protocol](https://modelcontextprotocol.io/) - MCP 프로토콜 사양
- [Puppeteer](https://pptr.dev/) - 웹 스크래핑 라이브러리
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings) - 임베딩 API
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript 가이드

### 커뮤니티
- GitHub Issues: https://github.com/jeromwolf/eve-mcp/issues
- Discussions: https://github.com/jeromwolf/eve-mcp/discussions

---

**작성일**: 2025-11-07
**작성자**: Claude Code
**버전**: 3.0.0
