# NRC ADAMS MCP 서버

미국 원자력규제위원회(NRC) ADAMS(Agency-wide Documents Access and Management System) 문서 검색 및 분석 서버 for Claude Desktop

---

**📖 문서 링크**
- 🚀 [5분 빠른 시작 가이드](QUICK_START_KO.md) ← **처음 설치하시나요? 여기부터!**
- 🔧 [문제 해결 가이드](TROUBLESHOOTING.md)
- 🌐 [English Documentation](README_ENG.md)

---

## ✨ 주요 기능

- 🔍 **사이트 검색**: NRC ADAMS 데이터베이스에서 문서 검색
- 📥 **자동 다운로드**: 상위 10개 문서 자동 다운로드 (설정 가능)
- 💬 **문서 채팅**: AI 기반 검색으로 다운로드한 문서와 대화
- 🧠 **RAG 지원**: OpenAI 또는 Claude API를 활용한 선택적 의미론적 검색
- 📊 **스마트 캐시**: 최대 50개 문서 LRU 캐시 관리

## 🚀 빠른 시작

### 1. 사전 요구사항

#### 1.1 Node.js 18+ 설치
```bash
# macOS (Homebrew 사용)
brew install node

# 또는 공식 사이트에서 다운로드
# https://nodejs.org/
```

설치 확인:
```bash
node --version  # v18.0.0 이상이어야 함
npm --version   # npm도 자동 설치됨
```

#### 1.2 Claude Desktop 설치
- **macOS**: [claude.ai/download](https://claude.ai/download)
- **Windows**: [claude.ai/download](https://claude.ai/download)

#### 1.3 OpenAI API 키 (선택사항, 권장)
- RAG 기능을 위해 필요 (정확도 95%)
- 발급: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- 비용: 문서 100개당 약 $0.10-$0.50

### 2. 프로젝트 설치
```bash
# 1. 저장소 클론
git clone https://github.com/jeromwolf/eve-mcp.git
cd eve-mcp

# 2. 의존성 설치 (npm 필수!)
npm install

# 3. TypeScript 빌드
npm run build
```

빌드 완료 확인:
```bash
ls build/index.js  # 파일이 존재해야 함
```

### 3. Claude Desktop 설정

#### macOS
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

다음 설정을 추가하세요:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/your_username/path/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

#### Windows
설정 파일 위치: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:/path/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### 4. Claude Desktop 재시작

**macOS**: `Cmd + Q` 후 다시 실행
**Windows**: 작업 표시줄에서 종료 후 다시 실행

### 5. 연결 확인

Claude Desktop에서 새 대화 시작 후:
```
"사용 가능한 도구 보여줘"
```

다음 도구들이 보여야 합니다:
- search_adams
- download_adams_documents
- ask_about_documents
- list_downloaded_documents
- clear_cache
- get_system_stats

## 📖 사용 가이드

### 1. NRC ADAMS 문서 검색

#### 기본 검색
```
"Search for emergency plan"
"Find reactor safety documents"
"Look for ML24001234"  // Document number search
```

#### 고급 검색
```
"Search for emergency plan from 2024"
"Find 20 documents about reactor"  // Custom result count (default: 50)
"Search safety analysis top 100"  // Max 100 results
```

### 2. 문서 다운로드

#### 자동 다운로드 (상위 10개)
```
"Download emergency plan documents"  // Downloads top 10 automatically
"Download reactor safety top 5"  // Custom download count
```

#### 수동 다운로드
```
"Download document #3"  // From search results
"Download documents 1, 3, 5"  // Multiple documents
```

#### 📁 다운로드 파일 위치
다운로드된 PDF는 다음 위치에 저장됩니다:
```
프로젝트폴더/downloaded_pdfs/검색키워드_날짜/ML문서번호.pdf

예시:
downloaded_pdfs/
├── emergency_plan_2025-09-30/
│   ├── ML020920623.pdf
│   ├── ML021450123.pdf
│   └── ...
└── reactor_safety_2025-10-01/
    ├── ML024270A144.pdf
    └── ...
```

**빠른 검색을 위한 텍스트 캐시:**
```
pdf-text-cache/
├── ML020920623.txt  (80KB - 텍스트 추출본)
├── ML021450123.txt
└── cache-index.json (캐시 인덱스)
```

💡 **팁**: Finder(macOS) 또는 탐색기(Windows)에서 직접 PDF 파일을 열어볼 수 있습니다!

### 3. 다운로드한 문서와 채팅

⚠️ **중요**: 다운로드 후 1-2초 대기하세요!
- MCP 프로토콜 특성상 각 요청이 독립적인 프로세스로 실행됩니다
- 첫 Q&A 호출 시 자동으로 문서를 로드합니다 (3-9초 소요)
- 이후 질문은 즉시 응답합니다 (1-3초)

#### 질문하기
```
"What are the main safety requirements?"
"Find information about emergency procedures"
"Summarize the reactor specifications"
```

#### 문서 내 검색
```
"Search for cooling system in downloaded files"
"Find emergency response procedures"
```

### 4. 캐시 관리

#### 다운로드한 문서 보기
```
"Show downloaded documents"
"List cached files"
```

#### 캐시 삭제
```
"Clear cache"
"Delete downloaded files"
```

## 🧠 RAG 설정 (선택사항)

RAG는 단순 키워드 매칭 대신 의미론적 검색을 가능하게 합니다. 자세한 내용은 [API_SETUP.md](API_SETUP.md)를 참고하세요.

### 빠른 설정

#### 옵션 1: OpenAI (권장)
- 벡터 임베딩을 통한 최고 정확도
- 비용: 문서 100개당 약 $0.10-$0.50
- API 키 발급: https://platform.openai.com/api-keys

#### 옵션 2: Claude/Anthropic
- Claude 계정이 있다면 추가 가입 불필요
- 임베딩 없이 직접 관련성 평가
- API 키 발급: https://console.anthropic.com

#### 옵션 3: API 키 없이 사용
- 키워드 검색으로 작동
- 무료지만 정확도 낮음
- 정확한 용어 매칭에 적합

### 성능 비교

| 방법 | 정확도 | 속도 | 비용 |
|--------|----------|-------|------|
| OpenAI 임베딩 | 95% | 빠름 | $0.0001/1K 토큰 |
| Claude 분석 | 85% | 보통 | $0.25/1M 토큰 |
| 키워드 검색 | 60% | 매우 빠름 | 무료 |

## 📁 프로젝트 구조

```
nrc-adams-mcp/
├── src/                    # TypeScript 소스 코드
├── build/                  # 컴파일된 JavaScript 출력
├── tests/                  # 테스트 파일 및 스크립트
│   ├── test-comprehensive.js  # 메인 테스트 스위트 (75% 성공률)
│   └── auto-test.sh           # 자동화된 테스트
├── docs/                   # 문서
│   ├── API_SETUP.md           # API 설정 가이드
│   └── logging_privacy_protection_guidelines.md
├── assets/                 # 스크린샷 및 리소스
├── downloaded_pdfs/        # PDF 캐시 (gitignored)
├── test-results/           # 테스트 출력 (gitignored)
├── logs/                   # 애플리케이션 로그
├── temp/                   # 임시 파일 (gitignored)
└── debug/                  # 디버그 파일 (gitignored)
```

## 🛠 개발

```bash
# 개발 모드
npm run dev

# 테스트 실행
node tests/test-comprehensive.js     # 전체 테스트 스위트
./tests/auto-test.sh                 # 빠른 자동화 테스트

# 특정 테스트 실행
node tests/test-simple.js            # 기본 기능
node tests/test-integration.js       # 통합 테스트

# 린트 검사
npm run lint

# 빌드
npm run build
```

## 📋 명령어 참조

### 검색 명령어
- `search_adams`: NRC ADAMS 데이터베이스 검색
- `download_adams_documents`: 검색 결과에서 문서 다운로드

### 문서 명령어
- `ask_about_documents`: 다운로드한 문서에 질의
- `list_downloaded_documents`: 캐시된 문서 표시
- `clear_cache`: 모든 다운로드한 문서 삭제

## 🔧 문제 해결

### 문서가 다운로드되지 않나요?
- 네트워크 연결 확인
- ADAMS에서 문서 가용성 확인
- 일부 문서는 제한될 수 있음

### 검색이 정확하지 않나요?
- RAG 기능을 위한 API 키 추가
- 더 구체적인 키워드 사용
- 설정은 API_SETUP.md 참조

### 캐시가 가득 찼나요?
- 50개 문서 후 자동 LRU 제거
- "캐시 삭제"로 수동 정리

## 📝 참고사항

- 캐시 최대 50개 문서 (LRU)
- 문서는 검색을 위해 텍스트로 추출됨
- 스캔/이미지 PDF는 파싱 실패 가능
- 검색 결과는 쿼리당 최대 100개로 제한

## 📄 라이선스

MIT License