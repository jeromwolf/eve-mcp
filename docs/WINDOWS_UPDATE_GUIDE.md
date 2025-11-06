# Windows 수동 업데이트 가이드

Git 연결 없이 다운로드한 사용자를 위한 수동 업데이트 방법입니다.

---

## 🎯 언제 업데이트가 필요한가요?

다음과 같은 경우 최신 코드로 업데이트하세요:
- ✅ **검색 결과가 0개**로 나올 때
- ✅ "Browser initialization failed" 오류 발생 시
- ✅ Windows 호환성 문제 발생 시
- ✅ 새로운 기능이 추가되었을 때

**최신 업데이트 (2025-11-06)**:
- Windows Puppeteer Chrome 경로 설정 지원
- networkAccess 도메인 추가 (adams-search.nrc.gov)
- 브라우저 타임아웃 60초로 증가

---

## 방법 1: 빠른 업데이트 (권장) ⚡

핵심 파일만 교체하는 가장 빠른 방법입니다.

### 1단계: 최신 코드 ZIP 다운로드

**다운로드 링크**: [eve-mcp-main.zip](https://github.com/jeromwolf/eve-mcp/archive/refs/heads/main.zip)

또는 수동 다운로드:
1. https://github.com/jeromwolf/eve-mcp 접속
2. 녹색 **Code** 버튼 클릭
3. **Download ZIP** 클릭

### 2단계: 기존 파일 백업 (중요!)

```powershell
# PowerShell 관리자 권한으로 실행
cd C:\Users\YourName\Documents

# 다운로드한 PDF와 캐시 백업
Copy-Item -Recurse eve-mcp\downloaded_pdfs .\downloaded_pdfs_backup -ErrorAction SilentlyContinue
Copy-Item -Recurse eve-mcp\pdf-text-cache .\pdf-text-cache_backup -ErrorAction SilentlyContinue

# .env 파일 백업 (있다면)
Copy-Item eve-mcp\.env .\.env_backup -ErrorAction SilentlyContinue
```

### 3단계: 기존 폴더 교체

```powershell
# 기존 폴더 이름 변경 (백업)
Rename-Item eve-mcp eve-mcp-old

# 다운로드한 ZIP 압축 해제
# (다운로드 폴더에서 eve-mcp-main.zip을 Documents로 이동 후 압축 해제)

# 폴더 이름 변경
Rename-Item eve-mcp-main eve-mcp
```

### 4단계: 백업 파일 복원

```powershell
cd eve-mcp

# PDF와 캐시 복원 (있다면)
Copy-Item -Recurse ..\downloaded_pdfs_backup .\downloaded_pdfs -ErrorAction SilentlyContinue
Copy-Item -Recurse ..\pdf-text-cache_backup .\pdf-text-cache -ErrorAction SilentlyContinue

# .env 복원 (있다면)
Copy-Item ..\.env_backup .\.env -ErrorAction SilentlyContinue
```

### 5단계: 의존성 재설치 및 빌드

```powershell
# node_modules 삭제 (깨끗한 재설치)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue

# 재설치
npm install

# 빌드
npm run build
```

**예상 출력**:
```
> nrc-adams-mcp@2.1.0 build
> tsc

(에러 없이 완료)
```

### 6단계: Claude Desktop 설정 업데이트

**설정 파일 열기**:
```powershell
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**완전한 설정 (복사해서 사용하세요)**:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Documents\\eve-mcp\\build\\index.js"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "OPENAI_API_KEY": "sk-proj-your-key-here",
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
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

**⚠️ 수정 필수 사항**:
1. `C:\\Users\\YourName\\Documents\\` → 본인의 실제 경로로 변경
2. `sk-proj-your-key-here` → 실제 OpenAI API 키
3. `sk-ant-your-key-here` → 실제 Anthropic API 키
4. Chrome 경로가 다르면 수정 (아래 확인 방법 참조)

**Chrome 경로 확인**:
```powershell
# 기본 경로 확인
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
# True가 출력되면 기본 경로 사용 가능

# Chrome 경로 찾기 (다른 경로에 설치된 경우)
Get-ChildItem -Path "C:\Program Files" -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue | Select-Object FullName
```

### 7단계: Claude Desktop 재시작

1. 작업 표시줄에서 Claude Desktop 우클릭
2. **종료** 클릭
3. Claude Desktop 다시 실행

### 8단계: 테스트

Claude Desktop에서 새 대화 시작:
```
small modular reactor를 nrc-adams-mcp 툴을 이용해서 검색해줘
```

**기대 결과**:
```
🔍 Search Results: small modular reactor
📊 Found 25 documents (showing top 25)

1. ML22117A023 - LTR-22-0122 Brian Smith Chairperson Small Modular Reactor...
2. ML25136A329 - Report on the Safety Aspects of the Nuscale US460 SMR...
3. ML20211M386 - Report on the Safety Aspects of the NuScale Small Modular...
...
```

---

## 방법 2: 개별 파일만 교체 (고급 사용자) 🔧

변경된 파일만 교체하는 방법입니다.

### 1단계: 변경된 파일 다운로드

브라우저에서 다음 파일들을 다운로드:

1. **src/adams-real-improved.ts** (핵심 파일)
   - https://raw.githubusercontent.com/jeromwolf/eve-mcp/main/src/adams-real-improved.ts
   - 우클릭 → "다른 이름으로 저장"

### 2단계: 파일 교체

```powershell
cd C:\Users\YourName\Documents\eve-mcp

# 백업
Copy-Item src\adams-real-improved.ts src\adams-real-improved.ts.backup

# 다운로드한 파일을 src\ 폴더에 복사
# (탐색기에서 드래그 앤 드롭 가능)
```

### 3단계: 재빌드

```powershell
npm run build
```

### 4단계: 설정 파일 업데이트

**방법 1 - 6단계**와 동일

---

## 방법 3: Git 연결 설정 (향후 자동 업데이트) 🔗

한 번만 설정하면 이후에는 `git pull`로 쉽게 업데이트할 수 있습니다.

### Git 설치 확인

```powershell
git --version
```

Git이 설치되어 있지 않으면:
- [Git for Windows 다운로드](https://git-scm.com/download/win)

### Git 원격 저장소 연결

```powershell
cd C:\Users\YourName\Documents\eve-mcp

# Git 초기화 (기존에 .git 폴더가 있으면 생략)
git init

# 원격 저장소 추가
git remote add origin https://github.com/jeromwolf/eve-mcp.git

# 원격 저장소 확인
git remote -v
```

**출력 예시**:
```
origin  https://github.com/jeromwolf/eve-mcp.git (fetch)
origin  https://github.com/jeromwolf/eve-mcp.git (push)
```

### 현재 파일 커밋 (선택사항)

```powershell
# 현재 상태 확인
git status

# 로컬 변경사항 커밋 (백업용)
git add .
git commit -m "Local version backup before update"
```

### 최신 코드 가져오기

```powershell
# 최신 코드 다운로드
git fetch origin

# 로컬 파일을 최신 버전으로 교체
git reset --hard origin/main
```

**⚠️ 주의**: `git reset --hard`는 로컬 변경사항을 모두 삭제합니다!
- `.env` 파일, 다운로드한 PDF 등은 `.gitignore`에 있어서 삭제되지 않습니다.
- 소스 코드를 수정했다면 백업 후 실행하세요.

### 이후 업데이트 (간단!)

```powershell
cd C:\Users\YourName\Documents\eve-mcp

# 최신 코드 가져오기
git pull origin main

# 재빌드
npm run build

# Claude Desktop 재시작
```

---

## 🔧 문제 해결

### 문제 1: "npm을 찾을 수 없습니다"

**증상**:
```
'npm'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는
배치 파일이 아닙니다.
```

**해결책**:
1. Node.js 재설치: https://nodejs.org/
2. PowerShell 재시작
3. 확인: `node --version` 및 `npm --version`

---

### 문제 2: "권한이 거부되었습니다"

**증상**:
```
Error: EPERM: operation not permitted
```

**해결책**:
1. PowerShell을 **관리자 권한**으로 실행
   - 시작 → "PowerShell" 검색
   - 우클릭 → "관리자 권한으로 실행"
2. 다시 명령 실행

---

### 문제 3: ZIP 압축 해제 오류

**증상**: "파일이 손상되었습니다" 또는 압축 해제 실패

**해결책**:
1. 다시 다운로드 (브라우저 캐시 문제일 수 있음)
2. 7-Zip 또는 WinRAR 사용
   - [7-Zip 다운로드](https://www.7-zip.org/)
3. PowerShell로 압축 해제:
   ```powershell
   Expand-Archive -Path "다운로드\eve-mcp-main.zip" -DestinationPath "C:\Users\YourName\Documents\" -Force
   ```

---

### 문제 4: 빌드 후에도 0개 결과

**가능한 원인**:
1. ❌ 설정 파일에 `networkAccess` 누락
2. ❌ Chrome 경로 잘못 설정
3. ❌ `adams-search.nrc.gov` 도메인 누락

**확인 방법**:
```powershell
# 설정 파일 내용 확인
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json"
```

**확인 사항**:
- [ ] `networkAccess` 섹션 존재
- [ ] `adams-search.nrc.gov` 포함
- [ ] `PUPPETEER_EXECUTABLE_PATH` 설정
- [ ] 경로에 `\\` (백슬래시 2개) 사용

**Chrome 경로 테스트**:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

정상 출력: `Google Chrome 120.0.6099.129`

---

### 문제 5: "Module not found" 오류

**증상**:
```
Error: Cannot find module 'C:\Users\...\build\index.js'
```

**해결책**:
1. 빌드 폴더 확인:
   ```powershell
   Test-Path "C:\Users\YourName\Documents\eve-mcp\build\index.js"
   ```

   False가 출력되면:
   ```powershell
   cd C:\Users\YourName\Documents\eve-mcp
   npm run build
   ```

2. 설정 파일 경로 확인:
   - `claude_desktop_config.json`의 `args` 경로가 정확한지 확인
   - 경로에 공백이 있으면 `\\` 사용 확인

---

## 📋 업데이트 체크리스트

업데이트 완료 후 다음 사항을 확인하세요:

- [ ] `npm run build` 성공 (에러 없음)
- [ ] `build/index.js` 파일 존재
- [ ] `claude_desktop_config.json` 업데이트 완료
- [ ] `networkAccess` 섹션 추가됨
- [ ] `adams-search.nrc.gov` 도메인 포함
- [ ] `PUPPETEER_EXECUTABLE_PATH` 설정
- [ ] Chrome 경로 정확함 (테스트 완료)
- [ ] Claude Desktop 재시작 완료
- [ ] 검색 테스트 성공 (25개 문서)

---

## 🆘 추가 도움말

### 로그 확인

문제가 계속되면 로그를 확인하세요:

```powershell
# MCP 서버 로그
Get-Content "C:\Users\YourName\Documents\eve-mcp\logs\mcp\mcp-server-*.log" -Tail 50

# 에러 로그
Get-Content "C:\Users\YourName\Documents\eve-mcp\logs\errors\error-*.log" -Tail 30
```

"Browser initialization failed" 메시지를 찾아보세요.

### 완전 초기화 (최후의 수단)

모든 것을 삭제하고 처음부터 다시 설치:

```powershell
cd C:\Users\YourName\Documents

# 전체 폴더 삭제
Remove-Item -Recurse -Force eve-mcp

# 최신 ZIP 다운로드 및 압축 해제
# https://github.com/jeromwolf/eve-mcp/archive/refs/heads/main.zip

# 설치
cd eve-mcp
npm install
npm run build

# 설정 파일 수정
notepad %APPDATA%\Claude\claude_desktop_config.json
```

---

## 📞 문제 보고

업데이트 후에도 문제가 해결되지 않으면:

1. [GitHub Issues](https://github.com/jeromwolf/eve-mcp/issues) 에 보고
2. 다음 정보 포함:
   - Windows 버전 (예: Windows 11 23H2)
   - Node.js 버전: `node --version`
   - Chrome 버전: `chrome --version`
   - 업데이트 방법 (방법 1, 2, 3 중 어느 것)
   - 에러 로그 (위 경로에서 복사)

---

**마지막 업데이트**: 2025-11-06
**대응 버전**: v2.1.0 (Commit f310e2b)
**주요 변경사항**: Windows Puppeteer 호환성 개선
