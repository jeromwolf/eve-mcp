# 문제 해결 가이드 (Troubleshooting Guide)

## 📋 목차
1. [RAG Q&A 문제](#rag-qa-문제)
2. [검색 실패 문제](#검색-실패-문제)
3. [다운로드 실패 문제](#다운로드-실패-문제)
4. [성능 문제](#성능-문제)

---

## 🔍 RAG Q&A 문제

### 증상: "문서 내용을 찾을 수 없습니다"

#### 📁 먼저 파일 위치 확인
다운로드된 파일들이 올바른 위치에 있는지 확인하세요:

```bash
# 프로젝트 루트 디렉토리에서
ls -la downloaded_pdfs/          # PDF 파일들
ls -la pdf-text-cache/            # 텍스트 캐시

# 특정 문서 확인
ls -lh downloaded_pdfs/*/ML020920623.pdf
ls -lh pdf-text-cache/ML020920623.txt
```

**정상 상태:**
```
downloaded_pdfs/
└── emergency_plan_2025-09-30/
    └── ML020920623.pdf  (2.5MB)

pdf-text-cache/
└── ML020920623.txt      (80KB)
```

파일이 없으면 다시 다운로드하세요.

---

#### 원인 1: PDF 텍스트 추출 실패
**진단:**
```bash
# PDF 텍스트 추출 테스트
node -e "
import('./build/pdf-extractor.js').then(async m => {
  const text = await m.extractTextFromPDF('downloaded_pdfs/your_folder/ML12345678.pdf');
  console.log('텍스트 길이:', text ? text.length : 0);
});
"
```

**해결 방법:**
- 스캔된 PDF는 OCR이 필요합니다 (현재 미지원)
- 이미지 기반 PDF는 텍스트 추출 불가
- 다른 문서를 시도하세요

---

#### 원인 2: RAG 인덱싱 안 됨
**진단:**
```bash
# 캐시 파일 확인
ls -lh pdf-text-cache/ML12345678.txt

# RAG 통계 확인 (list_downloaded_documents 도구 사용)
```

**해결 방법:**
1. **다운로드 후 자동 인덱싱 확인**
   - 다운로드 시 "📚 RAG Indexed: N" 메시지 확인
   - 0이면 텍스트 추출 실패

2. **수동 인덱싱 (ask_about_documents 호출)**
   - 첫 Q&A 호출 시 자동으로 기존 PDF 로드
   - `loadExistingPDFs()` 함수가 자동 실행됨

3. **캐시 재생성**
   ```bash
   # 캐시 삭제 후 재다운로드
   rm -rf pdf-text-cache/ML12345678.txt
   # MCP에서 다시 download_adams_documents 실행
   ```

---

#### 원인 3: API 키 없음
**증상:**
```
❌ RAG engine not enabled. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY
```

**해결 방법:**
1. `.env` 파일 생성
   ```bash
   echo "OPENAI_API_KEY=sk-..." > .env
   ```

2. Claude Desktop 설정에 API 키 추가
   ```json
   {
     "mcpServers": {
       "nrc-adams-mcp": {
         "env": {
           "OPENAI_API_KEY": "sk-..."
         }
       }
     }
   }
   ```

3. Claude Desktop 재시작

---

## 🔎 검색 실패 문제

### 증상: "검색 결과가 없습니다"

#### 원인 1: ADAMS API 500 에러
**자동 해결:**
- Puppeteer 브라우저 자동 fallback 작동
- 8-15초 대기 후 HTML 파싱

**로그 확인:**
```bash
tail -f logs/mcp/mcp-server-$(date +%Y-%m-%d).log | grep -i "search\|browser"
```

---

#### 원인 2: 키워드 문제
**증상:** 0개 결과 반환

**해결 방법:**
1. **더 일반적인 키워드 사용**
   - ❌ "very specific technical term 2024"
   - ✅ "reactor safety analysis"
   - ✅ "license renewal"

2. **연도 제거**
   - ❌ "emergency plan 2024"
   - ✅ "emergency plan"

3. **ML 문서 번호 직접 검색**
   - ✅ "ML24275A095"

---

#### 원인 3: 브라우저 타임아웃
**해결 방법:**
```typescript
// src/adams-real-improved.ts
// 대기 시간 증가 (현재 5-15초)
private readonly waitOptions = {
  minWait: 8000,    // 8초로 증가
  maxWait: 20000,   // 20초로 증가
  checkInterval: 500
};
```

재빌드 후 재시작:
```bash
npm run build
# Claude Desktop 재시작
```

---

## 📥 다운로드 실패 문제

### 증상: "Download failed"

#### 원인 1: ML 문서가 아님
**설명:**
- ADAMS는 ML 접두사 문서만 직접 다운로드 가능
- SECY, NUREG 등은 다운로드 링크 없음

**확인 방법:**
```bash
# 검색 결과에서 accessionNumber 확인
# ML로 시작하는지 체크
```

---

#### 원인 2: 네트워크 타임아웃
**해결 방법:**
1. **재시도 자동 실행** (3회 자동 재시도)
2. **타임아웃 증가**
   ```typescript
   // src/adams-real-improved.ts
   private readonly DOWNLOAD_TIMEOUT = 180000; // 3분으로 증가
   ```

---

#### 원인 3: PDF URL 형식 변경
**진단:**
```bash
# 직접 다운로드 테스트
curl -I "https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=ML12345678"
```

**해결:** ADAMS 사이트 구조 변경 시 코드 업데이트 필요

---

## ⚡ 성능 문제

### 증상: Q&A 응답 느림 (30초+)

#### 해결 방법 1: PDF 사전 캐싱
```bash
# 백그라운드 인덱싱
node scripts/index-pdfs.js
```

**효과:** 30초 → 0.05초 (600배 향상)

---

#### 해결 방법 2: 청크 크기 최적화
현재 설정 (권장):
```typescript
// src/rag-engine-enhanced.ts
private readonly CHUNK_SIZE = 2000;    // 2000자
private readonly CHUNK_OVERLAP = 200;  // 200자
```

임베딩 수 감소 → API 호출 감소 → 속도 향상

---

#### 해결 방법 3: 캐시 활용
**검색 결과 캐싱:**
- 동일 쿼리는 캐시에서 즉시 반환
- 캐시 히트율: `get_system_stats` 도구로 확인

---

## 🔧 고급 디버깅

### 로그 레벨 변경
```typescript
// src/mcp-logger.ts
// level: 'debug' 로 변경하여 상세 로그 확인
```

### MCP 프로토콜 테스트
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js
```

### 브라우저 디버깅
```typescript
// src/adams-real-improved.ts
this.browser = await puppeteer.launch({
  headless: false,  // 브라우저 UI 표시
  devtools: true    // DevTools 자동 열기
});
```

---

## 📞 지원

### 이슈 보고
1. 로그 파일 첨부: `logs/mcp/mcp-server-*.log`
2. 에러 메시지 전체 복사
3. 재현 단계 상세히 기술

### GitHub Issues
https://github.com/jeromwolf/eve-mcp/issues

---

## ✅ 체크리스트

다음 항목을 순서대로 확인하세요:

- [ ] Node.js 18+ 설치됨
- [ ] `npm install` 실행 완료
- [ ] `npm run build` 성공
- [ ] `.env` 파일에 API 키 설정 (선택)
- [ ] Claude Desktop 설정 파일 수정
- [ ] Claude Desktop 재시작
- [ ] MCP 서버 연결 확인 (도구 목록 표시)
- [ ] 검색 테스트 성공
- [ ] 다운로드 테스트 성공
- [ ] Q&A 테스트 성공

모든 항목 완료 시 정상 작동합니다! 🎉