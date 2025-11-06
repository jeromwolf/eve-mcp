# Windows 설치 가이드 (Windows Setup Guide)

## 🪟 Windows 전용 설치 및 문제 해결

이 가이드는 Windows 환경에서 NRC ADAMS MCP Server를 설치하고 실행하는 방법을 다룹니다.

---

## 📋 사전 요구사항

### 1. Node.js 설치
[Node.js 공식 사이트](https://nodejs.org/) 에서 **LTS 버전** 다운로드:
- 권장: v20.x 이상
- 설치 시 "Automatically install necessary tools" 체크

설치 확인:
```powershell
node --version  # v20.0.0 이상
npm --version   # v10.0.0 이상
```

### 2. Google Chrome 설치
Puppeteer가 Chrome을 사용하므로 반드시 설치 필요:
- [Chrome 다운로드](https://www.google.com/chrome/)
- 기본 경로에 설치: `C:\Program Files\Google\Chrome\Application\chrome.exe`

### 3. Claude Desktop 설치
- [Claude Desktop 다운로드](https://claude.ai/download)
- Windows 버전 설치

---

## 🚀 설치 단계

### 1. 프로젝트 다운로드
```powershell
# 원하는 위치로 이동 (예: Documents 폴더)
cd C:\Users\YourName\Documents

# Git clone
git clone https://github.com/jeromwolf/eve-mcp.git
cd eve-mcp
```

### 2. 의존성 설치
```powershell
npm install
```

**⚠️ Puppeteer 설치 오류 발생 시**:
```powershell
# Chrome 수동 설치 모드
$env:PUPPETEER_SKIP_DOWNLOAD="true"
npm install

# 또는 완전히 재설치
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### 3. TypeScript 빌드
```powershell
npm run build
```

**예상 출력**:
```
> nrc-adams-mcp@2.1.0 build
> tsc

(에러 없이 완료)
```

### 4. Chrome 경로 확인
Chrome이 기본 경로에 설치되어 있는지 확인:
```powershell
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
# True 출력되어야 함

# 또는 Chrome 버전 확인
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

**다른 경로에 설치된 경우**:
```powershell
# Chrome 실행 파일 찾기
Get-ChildItem -Path "C:\Program Files" -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Program Files (x86)" -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue
```

---

## ⚙️ Claude Desktop 설정 (중요!)

### 1. 설정 파일 열기
```powershell
# 메모장으로 설정 파일 열기
notepad $env:APPDATA\Claude\claude_desktop_config.json
```

**파일이 없으면 새로 만들기**:
```powershell
# 폴더 생성
New-Item -Path "$env:APPDATA\Claude" -ItemType Directory -Force

# 빈 JSON 파일 생성
'{}' | Out-File -FilePath "$env:APPDATA\Claude\claude_desktop_config.json" -Encoding utf8
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

### 2. 설정 추가 (기본 경로 Chrome 사용)

**⚠️ 중요: 경로는 반드시 `\\` 또는 `/` 사용**

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Documents\\eve-mcp\\build\\index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  },
  "networkAccess": {
    "allowedDomains": [
      "adams.nrc.gov",
      "adamswebsearch2.nrc.gov",
      "www.nrc.gov",
      "nrc.gov"
    ]
  }
}
```

**경로 예시**:
- ✅ `"C:\\Users\\Kelly\\Documents\\eve-mcp\\build\\index.js"` (백슬래시 이스케이프)
- ✅ `"C:/Users/Kelly/Documents/eve-mcp/build/index.js"` (슬래시 사용)
- ❌ `"C:\Users\Kelly\Documents\eve-mcp\build\index.js"` (이스케이프 없음 - 오류!)

### 3. Chrome 사용자 정의 경로 사용 (필요시)

Chrome이 다른 위치에 설치된 경우:

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Documents\\eve-mcp\\build\\index.js"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "OPENAI_API_KEY": "sk-proj-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  },
  "networkAccess": {
    "allowedDomains": [
      "adams.nrc.gov",
      "adamswebsearch2.nrc.gov",
      "www.nrc.gov",
      "nrc.gov"
    ]
  }
}
```

### 4. Chrome Canary 또는 Chromium 사용

```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Documents\\eve-mcp\\build\\index.js"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "C:\\Users\\YourName\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe",
        "OPENAI_API_KEY": "sk-proj-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

---

## 🧪 테스트

### 1. Claude Desktop 재시작
- 작업 표시줄에서 Claude Desktop 우클릭 → 종료
- Claude Desktop 다시 실행

### 2. 연결 확인
Claude Desktop에서 새 대화 시작:
```
Show me available tools
```

**기대 결과**: 6개 도구 표시
- search_adams
- download_adams_documents
- ask_about_documents
- list_downloaded_documents
- clear_cache
- get_system_stats

### 3. 검색 테스트
```
small modular reactor를 nrc-adams-mcp 툴을 이용해서 검색해줘
```

**기대 결과**: 20-25개 문서 검색됨

---

## 🔧 Windows 전용 문제 해결

### 문제 1: "0 results found" (검색 결과 없음)

**증상**:
```
🔍 Search Results: small modular reactor
📊 Found 0 documents
```

**원인**: Puppeteer가 Chrome을 실행하지 못함

**해결책 A - Chrome 경로 설정**:
1. Chrome 설치 확인:
   ```powershell
   Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
   ```

2. `claude_desktop_config.json`에 추가:
   ```json
   "env": {
     "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
   }
   ```

3. Claude Desktop 재시작

**해결책 B - Puppeteer 재설치**:
```powershell
cd C:\Users\YourName\Documents\eve-mcp
npm uninstall puppeteer
npm install puppeteer
npm run build
```

**해결책 C - 로그 확인**:
```powershell
# 로그 파일 확인
cd C:\Users\YourName\Documents\eve-mcp
Get-Content logs\mcp\mcp-server-*.log | Select-Object -Last 50
Get-Content logs\errors\error-*.log | Select-Object -Last 30
```

로그에서 "Browser initialization failed" 메시지 찾기

---

### 문제 2: "Cannot find module" (모듈 없음)

**증상**:
```
Error: Cannot find module 'C:\Users\...\build\index.js'
```

**원인**: 경로 오류 또는 빌드 안 됨

**해결책**:
1. 빌드 폴더 확인:
   ```powershell
   Test-Path "C:\Users\YourName\Documents\eve-mcp\build\index.js"
   ```

2. 빌드 재실행:
   ```powershell
   cd C:\Users\YourName\Documents\eve-mcp
   npm run build
   ```

3. 경로 이스케이프 확인:
   - ❌ `"C:\Users\..."` (잘못됨)
   - ✅ `"C:\\Users\..."` (올바름)
   - ✅ `"C:/Users/..."` (올바름)

---

### 문제 3: "Failed to connect to MCP server"

**증상**: Claude Desktop에서 도구가 보이지 않음

**원인**: JSON 형식 오류 또는 경로 오류

**해결책**:
1. JSON 유효성 검사:
   ```powershell
   Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json
   ```

   에러 없이 실행되어야 함

2. 온라인 JSON 검증기 사용:
   - [JSONLint](https://jsonlint.com/)
   - 설정 파일 내용 복사해서 검증

3. Claude Desktop 로그 확인:
   ```powershell
   Get-Content "$env:APPDATA\Claude\logs\mcp*.log" | Select-Object -Last 50
   ```

---

### 문제 4: Puppeteer 설치 실패

**증상**:
```
ERROR: Failed to download Chromium
```

**해결책 A - 수동 Chrome 사용**:
```powershell
# Puppeteer가 Chromium을 다운로드하지 않도록 설정
$env:PUPPETEER_SKIP_DOWNLOAD="true"
npm install

# 시스템 Chrome 사용 (claude_desktop_config.json)
"PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

**해결책 B - 프록시/방화벽 문제**:
```powershell
# npm 프록시 설정 (필요시)
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# 프록시 없이 재설치
npm config rm proxy
npm config rm https-proxy
npm install
```

---

### 문제 5: 한글 경로 문제

**증상**: 경로에 한글이 있으면 오류

**해결책**: 영문 경로로 이동
```powershell
# ❌ 잘못된 경로
C:\Users\김켈리\Documents\eve-mcp

# ✅ 올바른 경로
C:\Users\Kelly\Documents\eve-mcp
# 또는
C:\Projects\eve-mcp
```

---

### 문제 6: 권한 오류

**증상**:
```
Error: EPERM: operation not permitted
```

**해결책**: 관리자 권한으로 PowerShell 실행
1. 시작 메뉴에서 "PowerShell" 검색
2. 우클릭 → "관리자 권한으로 실행"
3. 프로젝트 폴더로 이동 후 `npm install` 재실행

---

## 📊 Windows 성능 최적화

### 1. Windows Defender 제외 추가
Puppeteer가 느린 경우:
1. Windows 보안 → 바이러스 및 위협 방지
2. 설정 관리 → 제외 항목 추가
3. 다음 폴더 추가:
   - `C:\Users\YourName\Documents\eve-mcp\node_modules`
   - `C:\Users\YourName\AppData\Local\ms-playwright`

### 2. 디스크 I/O 최적화
```powershell
# SSD에 프로젝트 설치 (HDD 대신)
# npm 캐시를 SSD로 이동
npm config set cache "C:\npm-cache" --global
```

---

## ✅ 설치 완료 확인

모든 설정이 완료되면 다음 체크리스트 확인:

- [ ] Node.js 설치됨 (v20+)
- [ ] Chrome 설치됨 (기본 경로)
- [ ] `npm install` 성공
- [ ] `npm run build` 성공
- [ ] `claude_desktop_config.json` 설정 완료
- [ ] 경로에 백슬래시 이스케이프 (`\\`) 적용
- [ ] `networkAccess` 도메인 추가
- [ ] Claude Desktop 재시작
- [ ] 6개 도구 표시됨
- [ ] 검색 테스트 성공 (25개 문서)

---

## 🆘 추가 도움말

### 로그 파일 위치 (디버깅용)

```powershell
# MCP 서버 로그
Get-Content "C:\Users\YourName\Documents\eve-mcp\logs\mcp\mcp-server-*.log" -Tail 50

# 에러 로그
Get-Content "C:\Users\YourName\Documents\eve-mcp\logs\errors\error-*.log" -Tail 30

# Claude Desktop 로그
Get-Content "$env:APPDATA\Claude\logs\mcp*.log" -Tail 50
```

### 완전 초기화 (모든 것 삭제 후 재설치)

```powershell
cd C:\Users\YourName\Documents\eve-mcp

# node_modules 삭제
Remove-Item -Recurse -Force node_modules

# 빌드 파일 삭제
Remove-Item -Recurse -Force build

# 캐시 삭제
Remove-Item -Recurse -Force downloaded_pdfs
Remove-Item -Recurse -Force pdf-text-cache
Remove-Item -Recurse -Force logs

# package-lock.json 삭제
Remove-Item package-lock.json

# 재설치
npm install
npm run build
```

---

## 📞 문제 보고

Windows 관련 문제가 계속되면:
1. [GitHub Issues](https://github.com/jeromwolf/eve-mcp/issues) 에 보고
2. 다음 정보 포함:
   - Windows 버전 (예: Windows 11 22H2)
   - Node.js 버전 (`node --version`)
   - Chrome 버전
   - 에러 로그 (위 경로에서 복사)

---

**마지막 업데이트**: 2025-11-06
**Windows 테스트 환경**: Windows 10/11, Node.js v20.11.0
