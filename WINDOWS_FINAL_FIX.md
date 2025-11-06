# Windows 최종 수정 가이드 (2025-11-06 v2)

## 🎯 이번 수정 사항

**코드 버전**: 2025-11-06-v2
**커밋**: 0c46d2a
**수정 내용**: Puppeteer detached frame 완전 해결

---

## ✅ 주요 개선사항

### 1. 버전 로깅 추가
로그에서 다음 메시지를 확인할 수 있습니다:
```
"message":"🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)"
```

이 메시지가 보이면 **최신 코드**입니다!

### 2. Navigation 방식 변경
- ❌ 이전: `waitUntil: 'networkidle2'` (Windows에서 불안정)
- ✅ 이후: `waitUntil: 'domcontentloaded'` + 2초 추가 대기

### 3. 재시도 로직 추가
- page.evaluate() 실패 시 **최대 3번 재시도**
- 각 재시도 사이 2초 대기
- 페이지 닫힘 여부 확인

### 4. 상세한 로깅
모든 단계에서 성공/실패 상태를 명확하게 표시:
- ✅ 성공
- ❌ 실패
- ⏳ 진행 중
- 📄 데이터 처리

---

## 🚀 설치 방법

### 1단계: 최신 코드 다운로드

```cmd
cd C:\Users\erica\Desktop\jeromspace

:: 기존 폴더 삭제 (관리자 권한 CMD)
taskkill /f /im node.exe
taskkill /f /im Claude.exe
timeout /t 3
rmdir /s /q eve-mcp

:: Git Clone
git clone https://github.com/jeromwolf/eve-mcp.git
```

**또는 ZIP 다운로드**:
```
https://github.com/jeromwolf/eve-mcp/archive/refs/heads/main.zip
```

### 2단계: 의존성 설치 및 빌드

```cmd
cd eve-mcp

npm install
npm run build
```

### 3단계: Claude Desktop 설정

```cmd
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**완전한 설정 (복사해서 사용)**:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:\\Users\\erica\\Desktop\\jeromspace\\eve-mcp\\build\\index.js"],
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
      "adams-search.nrc.gov",
      "adamswebsearch2.nrc.gov",
      "www.nrc.gov",
      "nrc.gov"
    ]
  }
}
```

**⚠️ 수정 필수**:
- 경로를 실제 경로로 변경
- API 키를 실제 키로 변경

### 4단계: Claude Desktop 재시작

```cmd
taskkill /f /im Claude.exe
timeout /t 3
:: Claude Desktop 실행
```

### 5단계: 테스트

```
small modular reactor를 검색해줘
```

**기대 결과**:
```
🔍 Search Results: small modular reactor
📊 Found 25 documents

1. ML22117A023 - ...
2. ML25136A329 - ...
...
```

---

## 🔍 버전 확인 방법

### 로그에서 버전 확인

```cmd
cd C:\Users\erica\Desktop\jeromspace\eve-mcp

:: 최신 로그 확인
type logs\mcp\mcp-server-2025-11-06.log | findstr "CODE VERSION"
```

**올바른 출력**:
```json
{"message":"🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)"}
```

**이 메시지가 안 보이면**:
- 빌드가 안 됨
- 옛날 코드 실행 중
- → **재빌드 필요!**

---

## 📊 성공 로그 패턴

정상 작동 시 로그:

```json
{"message":"🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)"}
{"message":"Navigating to search URL"}
{"message":"✅ Page navigation completed"}
{"message":"✅ Post-navigation wait completed"}
{"message":"⏳ Waiting for search results..."}
{"message":"Results found after 8500ms"}
{"message":"✅ waitForResults returned: true"}
{"message":"📄 Starting page evaluation..."}
{"message":"🔄 Evaluation attempt 1/3"}
{"message":"✅ Evaluation successful, found 25 documents"}
{"message":"📊 Browser search found 25 documents"}
```

---

## ❌ 여전히 0건이 나올 때

### 체크리스트

1. **버전 확인**:
   ```cmd
   type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
   ```
   → "2025-11-06-v2" 보여야 함

2. **빌드 확인**:
   ```cmd
   dir /TC build\adams-real-improved.js
   ```
   → 빌드 시간이 최근이어야 함

3. **설정 파일 확인**:
   ```cmd
   findstr "networkAccess" %APPDATA%\Claude\claude_desktop_config.json
   ```
   → networkAccess 있어야 함

4. **Chrome 경로 확인**:
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --version
   ```
   → Chrome 버전 나와야 함

---

## 🔧 완전 재설치 스크립트

모든 것을 처음부터:

```batch
@echo off
echo ========================================
echo eve-mcp 완전 재설치 (v2025-11-06-v2)
echo ========================================
echo.

:: 1. 프로세스 종료
taskkill /f /im node.exe 2>nul
taskkill /f /im Claude.exe 2>nul
timeout /t 3 /nobreak >nul

:: 2. 기존 폴더 삭제
cd C:\Users\erica\Desktop\jeromspace
if exist eve-mcp (
    rmdir /s /q eve-mcp
    echo ✅ 기존 폴더 삭제
)

:: 3. Git Clone
git clone https://github.com/jeromwolf/eve-mcp.git
if %errorlevel% neq 0 (
    echo ❌ Git clone 실패!
    pause
    exit /b 1
)
echo ✅ Clone 완료

:: 4. 설치 및 빌드
cd eve-mcp
call npm install
call npm run build
echo ✅ 빌드 완료

:: 5. 버전 확인
echo.
echo ========================================
echo 버전 확인:
echo ========================================
findstr "CODE VERSION" src\adams-real-improved.ts
echo.

echo ========================================
echo ✅ 설치 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. Claude Desktop 설정 확인
echo 2. Claude Desktop 재시작
echo 3. "small modular reactor 검색해줘" 테스트
echo.
pause
```

위 내용을 `reinstall-v2.bat`로 저장 후 **관리자 권한으로 실행**

---

## 📞 디버깅 명령어

### 로그 분석
```cmd
cd C:\Users\erica\Desktop\jeromspace\eve-mcp

:: 버전 확인
type logs\mcp\*.log | findstr "CODE VERSION"

:: 에러 확인
type logs\mcp\*.log | findstr "ERROR"

:: 성공 확인
type logs\mcp\*.log | findstr "Evaluation successful"

:: 전체 검색 흐름
type logs\mcp\*.log | findstr "small modular reactor"
```

### 파일 날짜 확인
```cmd
:: 소스 파일
dir /TC src\adams-real-improved.ts

:: 빌드 파일
dir /TC build\adams-real-improved.js
```

빌드 파일이 소스 파일보다 오래되었으면 재빌드!

---

## 🎯 기대 결과

### 성공 시나리오

1. **검색 실행**:
   ```
   "small modular reactor 검색해줘"
   ```

2. **로그 확인**:
   ```json
   {"message":"🔄 CODE VERSION: 2025-11-06-v2"}
   {"message":"✅ Page navigation completed"}
   {"message":"✅ Evaluation successful, found 25 documents"}
   ```

3. **결과 확인**:
   ```
   📊 Found 25 documents
   1. ML22117A023 - LTR-22-0122 Brian Smith...
   2. ML25136A329 - Report on the Safety...
   ```

---

## 📋 변경 사항 요약

| 항목 | 이전 | 이후 |
|------|------|------|
| waitUntil | networkidle2 | domcontentloaded |
| 안정화 대기 | 없음 | 2초 |
| 재시도 | 1회 | 3회 |
| 로깅 | 기본 | 상세 (이모지) |
| 버전 확인 | 불가능 | 로그에서 확인 |
| 에러 핸들링 | 기본 | 단계별 try-catch |

---

## ✅ 최종 확인

설치 완료 후 확인:

- [ ] `npm run build` 성공
- [ ] `logs\mcp` 폴더에 로그 생성
- [ ] 로그에 "CODE VERSION: 2025-11-06-v2" 있음
- [ ] 설정 파일에 `networkAccess` 있음
- [ ] Chrome 경로 정확함
- [ ] Claude Desktop 재시작 완료
- [ ] 검색 테스트 성공 (25개 결과)

---

**업데이트 날짜**: 2025-11-06
**코드 버전**: 2025-11-06-v2
**커밋**: 0c46d2a
**상태**: ✅ 프로덕션 배포 완료
