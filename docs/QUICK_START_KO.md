# 🚀 빠른 시작 가이드 (5분 설치)

**✅ Windows/Mac 모두 정상 작동** (2025-11-07 업데이트)

---

## ⚠️ 설치 전 필독!

**가장 흔한 실수 TOP 3:**

1. **🔴 빌드를 안 함** ← 90%의 문제 원인!
   - `npm run build` 필수!
   - 코드 업데이트 후에도 재빌드 필요

2. **❌ 상대 경로 사용**
   - ❌ `~/eve-mcp/build/index.js`
   - ✅ `/Users/kelly/eve-mcp/build/index.js` (절대 경로)

3. **❌ Claude Desktop 재시작 안 함**
   - 설정 변경 후 **완전히 종료** 후 재실행

---

## ✅ 체크리스트

설치 전 이 항목들을 순서대로 확인하세요:

- [ ] **1단계**: Node.js 18+ 설치 완료
- [ ] **2단계**: OpenAI API 키 발급 완료 ⚠️ **필수!**
- [ ] **3단계**: Claude Desktop 설치 완료
- [ ] **4단계**: 프로젝트 클론 및 **빌드 완료** ⚠️ 필수!
- [ ] **5단계**: Claude Desktop 설정 완료 (API 키 포함)
- [ ] **6단계**: 연결 테스트 성공

**🔴 가장 중요한 필수 사항:**
1. **OpenAI API 키**: RAG Q&A 기능에 필수 (검색/다운로드는 API 키 없이 가능)
2. **프로젝트 빌드**: 빌드 없이는 작동하지 않습니다
3. **코드 업데이트 후 재빌드 필요**

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

## 2️⃣ OpenAI API 키 발급 (필수) ⚠️

**RAG Q&A 기능을 사용하려면 반드시 필요합니다!**

### API 키 발급 절차

1. **OpenAI 계정 생성**
   - [platform.openai.com](https://platform.openai.com) 방문
   - "Sign up" 클릭하여 계정 생성

2. **API 키 생성**
   - 로그인 후 우측 상단 프로필 클릭
   - "API keys" 메뉴 선택
   - "Create new secret key" 클릭
   - 키 이름 입력 (예: "eve-mcp")
   - **⚠️ 중요**: 생성된 키를 안전한 곳에 복사 저장 (다시 볼 수 없음!)

3. **사용 요금 안내**
   - 문서 임베딩: `text-embedding-ada-002` 모델 사용
   - 비용: 약 $0.0001 per 1000 tokens (매우 저렴)
   - 예상 비용: 문서 100개 처리 시 약 $0.10~0.50
   - 무료 크레딧: 신규 가입 시 $5 제공 (3개월 유효)

### 기능별 API 키 필요 여부

| 기능 | API 키 필요 | 설명 |
|------|------------|------|
| 🔍 ADAMS 검색 | ❌ 불필요 | 키 없이 작동 |
| ⬇️ PDF 다운로드 | ❌ 불필요 | 키 없이 작동 |
| 💬 RAG Q&A | ✅ **필수** | OpenAI 임베딩 사용 |
| 📊 통계 조회 | ❌ 불필요 | 키 없이 작동 |

**💡 팁**: 검색과 다운로드만 필요하면 API 키 없이 사용 가능합니다!

---

## 3️⃣ Claude Desktop 설치 (필수)

### 다운로드
- **macOS & Windows**: [claude.ai/download](https://claude.ai/download)

### 설치 확인
Claude Desktop을 실행하고 로그인하세요.

---

## 4️⃣ 프로젝트 설치 및 빌드 (5분)

**🔴 이 단계가 가장 중요합니다!**

### 터미널 열기
- **macOS**: `Cmd + Space` → "Terminal" 입력
- **Windows**: `Win + R` → "cmd" 입력

### 명령어 실행 (복사해서 붙여넣기)
```bash
# 1. 홈 디렉토리로 이동
cd ~

# 2. 프로젝트 클론
git clone https://github.com/jeromwolf/eve-mcp.git

# 3. 프로젝트 폴더로 이동
cd eve-mcp

# 4. 의존성 설치 (1-2분 소요)
npm install

# 5. 빌드 (30초 소요) - ⚠️ 필수!
npm run build

# 6. 빌드 확인
# macOS/Linux:
ls build/index.js

# Windows:
dir build\index.js
```

**성공 시 출력:**
```
# macOS/Linux
build/index.js

# Windows
...  index.js
```

**⚠️ 빌드 실패 시:**
```bash
# TypeScript 컴파일러가 없다는 에러가 나면
npm install

# 그리고 다시 빌드
npm run build
```

**🔴 중요! 빌드를 안 하면:**
- MCP 서버가 시작되지 않음
- Claude Desktop에서 도구가 안 보임
- 코드 변경사항이 적용 안 됨

**✅ 빌드 완료 체크:**
- [ ] `build/index.js` 파일이 생성되었나요?
- [ ] 에러 메시지 없이 완료되었나요?

---

## 4️⃣ Claude Desktop 설정 (3분)

**💡 팁: 경로 확인이 가장 중요합니다!**

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

### STEP 1: 프로젝트 절대 경로 확인 (필수!)

**🔴 절대 경로를 정확히 확인하세요!**

```bash
# eve-mcp 폴더에서 실행 (3단계에서 이미 이 폴더에 있음)
pwd
```

**출력 예시:**
```
/Users/kelly/eve-mcp                    # macOS
C:\Users\kelly\eve-mcp                  # Windows
```

**💡 중요:**
1. 이 경로를 **메모장에 복사**해두세요
2. `~` 같은 약어가 아닌 **전체 경로**여야 함
3. Windows는 `\` (백슬래시) 사용

---

### STEP 2: 설정 파일 작성

**⚠️ 두 가지 필수 설정:**
1. **절대 경로**: 위에서 확인한 경로 + `/build/index.js`
2. **OpenAI API 키**: 2단계에서 발급받은 키 (sk-proj-로 시작)

**예시:**
- pwd 결과: `/Users/kelly/eve-mcp`
- 설정에 입력: `/Users/kelly/eve-mcp/build/index.js` ✅
- API 키: `sk-proj-xxxxxxxxxxxxxxxx` ✅

#### macOS 예시:
`pwd` 결과가 `/Users/kelly/eve-mcp`인 경우:

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/kelly/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-xxxxxxxxxxxxxxxx"
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

**⚠️ macOS도 networkAccess 필요!**
- NRC 웹사이트 접근 허용
- `mcpServers` 밖, 최상위 레벨에 위치

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
- `PUPPETEER_EXECUTABLE_PATH`: (Windows 필수!) Chrome 설치 경로
  - 기본 경로가 다르면 실제 경로로 수정
  - 예: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `networkAccess`: (macOS/Windows 모두 필수!) NRC 웹사이트 접근 허용
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

### STEP 1: Claude Desktop 완전히 종료

**⚠️ 창만 닫으면 안 됩니다!**

- **macOS**: `Cmd + Q` (완전 종료)
- **Windows**:
  1. 작업 관리자 열기 (`Ctrl + Shift + Esc`)
  2. Claude.exe 찾아서 "작업 끝내기"

### STEP 2: Claude Desktop 다시 시작

### STEP 3: 도구 확인

Claude Desktop에서 새 대화 시작:
```
사용 가능한 도구 보여줘
```

**✅ 성공 시 표시되는 도구들 (6개):**
- search_adams
- download_adams_documents
- ask_about_documents
- list_downloaded_documents
- clear_cache
- get_system_stats

**❌ 도구가 안 보이면:**
→ 아래 "문제 해결" 섹션으로 이동

---

## 🎉 첫 번째 사용 (설치 확인)

**💡 순서대로 테스트하세요:**

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

### "도구가 안 보여요" (가장 흔한 문제!)
1. **🔴 빌드를 했나요?** (가장 흔한 원인!)
   ```bash
   cd eve-mcp
   npm run build
   ```
   - 빌드 안 하면 작동 안 됨!
   - 코드 업데이트 후에도 재빌드 필요!

2. Claude Desktop을 **완전히 종료**했나요?
   - macOS: `Cmd + Q` (창 닫기만으론 부족!)
   - Windows: 작업 관리자에서 완전 종료

3. 설정 파일 경로가 **절대 경로**인가요?
   - ❌ `~/eve-mcp/build/index.js` (상대 경로)
   - ✅ `/Users/kelly/eve-mcp/build/index.js` (절대 경로)

4. `build/index.js` 파일이 존재하나요?
   ```bash
   # macOS/Linux
   ls ~/eve-mcp/build/index.js

   # Windows
   dir C:\Users\YourName\eve-mcp\build\index.js
   ```

5. **Windows 사용자**: `networkAccess` 설정이 최상위에 있나요?
   - `mcpServers` 안에 있으면 ❌
   - `mcpServers` 밖에 있으면 ✅

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
  npm --version
  ```
- 터미널을 재시작해보세요
- Windows: 설치 후 **새 CMD 창** 열기

### "검색은 되는데 0건이 나와요" (Windows)
1. Chrome이 설치되어 있나요?
2. `PUPPETEER_EXECUTABLE_PATH`가 설정되어 있나요?
   ```json
   "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
   ```
3. 빌드를 최신으로 했나요?
   ```bash
   npm run build
   ```

### "코드를 수정했는데 적용이 안 돼요"
**반드시 재빌드하세요!**
```bash
cd eve-mcp
npm run build
```
그리고 Claude Desktop 재시작

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