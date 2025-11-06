# 🚀 빠른 시작 가이드 (5분 설치)

## ✅ 체크리스트

설치 전 이 항목들을 순서대로 확인하세요:

- [ ] **1단계**: Node.js 18+ 설치 완료
- [ ] **2단계**: Claude Desktop 설치 완료
- [ ] **3단계**: 프로젝트 클론 및 빌드 완료
- [ ] **4단계**: Claude Desktop 설정 완료
- [ ] **5단계**: 연결 테스트 성공

---

## 1️⃣ Node.js 설치 (필수)

### macOS
```bash
# Homebrew가 있다면
brew install node

# 또는 공식 사이트에서 다운로드
# https://nodejs.org/
```

### Windows
1. [nodejs.org](https://nodejs.org/) 방문
2. "LTS" 버전 다운로드 (18.x 이상)
3. 설치 프로그램 실행

### 설치 확인
```bash
node --version  # v18.0.0 이상
npm --version   # 자동 설치됨
```

---

## 2️⃣ Claude Desktop 설치 (필수)

### 다운로드
- **macOS & Windows**: [claude.ai/download](https://claude.ai/download)

### 설치 확인
Claude Desktop을 실행하고 로그인하세요.

---

## 3️⃣ 프로젝트 설치 (5분)

### 터미널 열기
- **macOS**: `Cmd + Space` → "Terminal" 입력
- **Windows**: `Win + R` → "cmd" 입력

### 명령어 실행
```bash
# 1. 홈 디렉토리로 이동
cd ~

# 2. 프로젝트 클론
git clone https://github.com/jeromwolf/eve-mcp.git

# 3. 프로젝트 폴더로 이동
cd eve-mcp

# 4. 의존성 설치 (1-2분 소요)
npm install

# 5. 빌드 (30초 소요)
npm run build

# 6. 빌드 확인
ls build/index.js
```

**성공 시 출력:**
```
build/index.js
```

---

## 4️⃣ Claude Desktop 설정 (3분)

### 설정 파일 열기

#### macOS
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```
(탐색기 주소창에 붙여넣기)

### 2-1단계: 프로젝트 절대 경로 확인

먼저 프로젝트가 설치된 **정확한 경로**를 확인하세요:

```bash
# eve-mcp 폴더에서 실행 (3번 단계에서 이미 들어가 있음)
pwd
```

**출력 예시**:
```
/Users/kelly/eve-mcp                    # macOS 예시
C:\Users\kelly\eve-mcp                  # Windows 예시 (보통 cmd에서는 역슬래시로 표시)
```

💡 **Tip**: 이 경로를 복사해두세요! 다음 단계에서 사용합니다.

---

### 2-2단계: 설정 파일 작성

위에서 확인한 **절대 경로**를 사용해서 설정하세요.

#### macOS 예시:
`pwd` 결과가 `/Users/kelly/eve-mcp`인 경우:

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/kelly/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

#### Windows 예시:
`pwd` 결과가 `C:\Users\kelly\eve-mcp`인 경우:

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\kelly\\eve-mcp\\build\\index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      }
    }
  },
  "networkAccess": {
    "allowedDomains": [
      "adams.nrc.gov",
      "adams-search.nrc.gov",
      "adamswebsearch2.nrc.gov",
      "www.nrc.gov",
      "nrc.gov"
    ]
  }
}
```

**⚠️ 중요! Windows 설정 주의사항:**

| 항목 | 잘못된 예 ❌ | 올바른 예 ✅ | 이유 |
|------|------------|------------|------|
| **경로 구분자** | `"C:/Users/..."` | `"C:\\Users\\"` | JSON에서는 `\\` (이중 백슬래시) 사용 |
| **절대 경로** | `~/eve-mcp/build/index.js` | `C:\\Users\\kelly\\eve-mcp\\build\\index.js` | 절대 경로 필수 |
| **파일명 포함** | `C:\\Users\\kelly\\eve-mcp` | `C:\\Users\\kelly\\eve-mcp\\build\\index.js` | `\\build\\index.js` 추가 필수 |
| **networkAccess 위치** | `mcpServers` 안에 있음 | `mcpServers` 밖, 최상위 레벨 | 구조 오류 방지 |

**🔴 자주 발생하는 Windows 오류:**

```json
// ❌ 잘못된 예 - networkAccess 위치 오류
{
  "mcpServers": {
    "nrc-adams-mcp": {
      ...
      "networkAccess": {  // ← 여기 있으면 안 됨!
        ...
      }
    }
  }
}

// ✅ 올바른 예 - networkAccess가 최상위에
{
  "mcpServers": {
    "nrc-adams-mcp": {
      ...
    }
  },
  "networkAccess": {  // ← 여기 있어야 함!
    ...
  }
}
```

**⚠️ 추가 설명:**
- `PUPPETEER_EXECUTABLE_PATH`: Chrome이 기본 경로에 없을 때 필요
- `networkAccess`: Claude Desktop이 NRC 웹사이트 접근하도록 허용
- `networkAccess`는 **반드시 최상위 레벨**에 위치해야 함!

**올바른 경로 만드는 3단계:**
```bash
# 1. pwd로 경로 확인
pwd
# 출력: /Users/kelly/eve-mcp

# 2. 끝에 /build/index.js 추가
# 결과: /Users/kelly/eve-mcp/build/index.js

# 3. JSON의 args에 입력
"args": ["/Users/kelly/eve-mcp/build/index.js"]
```

**추가 참고:**
- `OPENAI_API_KEY`는 선택사항 (없어도 작동, 있으면 정확도 향상)

---

## 5️⃣ 연결 테스트 (1분)

### Claude Desktop 재시작
- **macOS**: `Cmd + Q` 후 다시 실행
- **Windows**: 완전히 종료 후 다시 실행

### 도구 확인
Claude Desktop에서 새 대화 시작:
```
사용 가능한 도구 보여줘
```

**성공 시 표시되는 도구들:**
- ✅ search_adams
- ✅ download_adams_documents
- ✅ ask_about_documents
- ✅ list_downloaded_documents
- ✅ clear_cache
- ✅ get_system_stats

---

## 🎉 첫 번째 사용

### 1. 문서 검색
```
"emergency plan" 검색해줘
```

### 2. 문서 다운로드
```
상위 5개 문서 다운로드해줘
```

**다운로드 위치 확인:**
```bash
ls -la ~/eve-mcp/downloaded_pdfs/
```

### 3. 문서 질문 (1-2초 대기 후!)
```
주요 안전 요구사항이 뭐야?
```

---

## 📁 파일 구조

설치 후 프로젝트 구조:
```
eve-mcp/
├── build/                  # 빌드된 JavaScript (자동 생성)
│   └── index.js           # MCP 서버 실행 파일
├── downloaded_pdfs/        # 다운로드된 PDF (자동 생성)
│   └── emergency_plan_2025-09-30/
│       └── ML020920623.pdf
├── pdf-text-cache/         # 텍스트 캐시 (자동 생성)
│   └── ML020920623.txt
├── logs/                   # 로그 파일 (자동 생성)
│   └── mcp/
│       └── mcp-server-2025-09-30.log
├── src/                    # TypeScript 소스 코드
├── package.json            # Node.js 설정
├── README.md               # 한글 문서
└── README_ENG.md           # 영문 문서
```

---

## ❓ 문제 해결

### "도구가 안 보여요"
1. Claude Desktop을 **완전히 종료**했나요?
2. 설정 파일 경로가 **절대 경로**인가요?
3. `build/index.js` 파일이 존재하나요?
   ```bash
   ls ~/eve-mcp/build/index.js
   ```

### "검색 결과가 없어요"
- 더 일반적인 키워드 사용: "reactor safety", "emergency plan"
- 연도 제거: ~~"emergency plan 2024"~~ → "emergency plan"

### "문서 내용을 못 찾아요"
- 다운로드 후 **1-2초 대기**하셨나요?
- 첫 Q&A는 **3-9초** 소요됩니다 (자동 로딩)
- PDF 파일이 존재하는지 확인:
  ```bash
  ls ~/eve-mcp/downloaded_pdfs/
  ls ~/eve-mcp/pdf-text-cache/
  ```

### "npm 명령어가 안 돼요"
- Node.js를 설치하셨나요?
  ```bash
  node --version
  ```
- 터미널을 재시작해보세요

---

## 🔑 OpenAI API 키 설정 (선택사항)

RAG 정확도를 높이려면 API 키를 추가하세요:

### 1. API 키 발급
1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) 방문
2. "Create new secret key" 클릭
3. 키 복사 (sk-로 시작)

### 2. 설정 추가
Claude Desktop 설정 파일에 추가:
```json
"env": {
  "OPENAI_API_KEY": "sk-proj-여기에_키_붙여넣기"
}
```

### 3. 재시작
Claude Desktop 완전히 종료 후 재실행

### 비용
- 문서 100개당 약 $0.10-$0.50
- 검색 정확도: 60% → 95% 향상

---

## 📚 자세한 문서

- **전체 가이드**: [README.md](README.md)
- **문제 해결**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **English Version**: [README_ENG.md](README_ENG.md)

---

## 💬 지원

- **GitHub Issues**: [github.com/jeromwolf/eve-mcp/issues](https://github.com/jeromwolf/eve-mcp/issues)
- **로그 확인**: `~/eve-mcp/logs/mcp/`

---

**설치 완료! 🎉**

이제 Claude Desktop에서 NRC ADAMS 문서를 검색하고 분석할 수 있습니다.