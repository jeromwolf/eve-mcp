# 윈도우 사용자를 위한 긴급 업데이트 안내

## 🔴 현재 상황

로그 분석 결과:
- ❌ "CODE VERSION: 2025-11-06-v2" **없음**
- ❌ 여전히 옛날 코드가 실행되고 있음
- ❌ 빌드는 했지만 **소스 코드가 옛날 버전**

## 📊 GitHub 상태

✅ **GitHub에는 최신 코드 있음**:
- 커밋: `0c46d2a`
- 날짜: 2025-11-06
- 내용: Windows Puppeteer 완전 수정

README 파일이 2시간 전이라는 것은 정상입니다 (README는 더 이전에 수정됨).

**중요한 것은 `src/adams-real-improved.ts` 파일입니다!**

## 🚀 해결 방법

### 1단계: Git Pull로 최신 코드 받기

```cmd
cd C:\Users\erica\Desktop\jeromspace\eve-mcp

:: 현재 상태 확인
git status

:: 최신 코드 가져오기
git pull origin main
```

**기대 결과**:
```
Updating 73bc574..a61d9fd
Fast-forward
 src/adams-real-improved.ts | 150 ++++++++++++++++++++++++++++-----------
 WINDOWS_FINAL_FIX.md       | 355 +++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 450 insertions(+), 55 deletions(-)
```

### 2단계: 소스 코드 확인

```cmd
findstr "CODE VERSION" src\adams-real-improved.ts
```

**기대 결과**:
```typescript
logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
```

**만약 안 나오면**: Git pull이 제대로 안 된 것입니다.

### 3단계: 재빌드

```cmd
:: build 폴더 삭제
rmdir /s /q build

:: 빌드
npm run build

:: 빌드 파일 확인
findstr "CODE VERSION" build\adams-real-improved.js
```

**기대 결과**:
```javascript
logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
```

### 4단계: Claude Desktop 재시작 및 테스트

```cmd
taskkill /f /im Claude.exe
timeout /t 3
:: Claude Desktop 실행
```

검색 테스트:
```
"small modular reactor 검색해줘"
```

### 5단계: 로그 확인

```cmd
type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
```

**기대 결과**:
```json
{"message":"🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)"}
```

## 🔍 Git Pull이 안 될 때

### 방법 A: 기존 변경사항 버리기

```cmd
cd C:\Users\erica\Desktop\jeromspace\eve-mcp

:: 로컬 변경사항 버리기
git reset --hard

:: 최신 코드 받기
git pull origin main

:: 소스 코드 확인
findstr "CODE VERSION" src\adams-real-improved.ts
```

### 방법 B: 완전 재설치

```cmd
:: 1. 관리자 권한 CMD

:: 2. 프로세스 종료
taskkill /f /im node.exe
taskkill /f /im Claude.exe
timeout /t 3

:: 3. 폴더 이동 (삭제 대신)
cd C:\Users\erica\Desktop\jeromspace
ren eve-mcp eve-mcp-old

:: 4. 새로 clone
git clone https://github.com/jeromwolf/eve-mcp.git

:: 5. 설치 및 빌드
cd eve-mcp
npm install
npm run build

:: 6. 버전 확인
findstr "CODE VERSION" build\adams-real-improved.js
```

### 방법 C: 특정 파일만 다운로드

GitHub에서 직접 다운로드:

1. **소스 파일 다운로드**:
   ```
   https://raw.githubusercontent.com/jeromwolf/eve-mcp/main/src/adams-real-improved.ts
   ```

   → `C:\Users\erica\Desktop\jeromspace\eve-mcp\src\adams-real-improved.ts`에 저장

2. **버전 확인**:
   ```cmd
   findstr "CODE VERSION" src\adams-real-improved.ts
   ```

   **있어야 함**:
   ```typescript
   logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
   ```

3. **재빌드**:
   ```cmd
   rmdir /s /q build
   npm run build
   findstr "CODE VERSION" build\adams-real-improved.js
   ```

## 📋 진단 체크리스트

실행 순서:

```cmd
:: 1. 소스 파일 확인
findstr "CODE VERSION" src\adams-real-improved.ts

:: 2. 빌드 파일 확인
findstr "CODE VERSION" build\adams-real-improved.js

:: 3. 최신 로그 확인
type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
```

**예상 결과**:

| 단계 | 파일 | 결과 |
|------|------|------|
| 1 | src\adams-real-improved.ts | ✅ 있어야 함 |
| 2 | build\adams-real-improved.js | ✅ 있어야 함 |
| 3 | logs\mcp\*.log | ✅ 있어야 함 |

**하나라도 없으면**:
- 1번 없음 → Git pull 필요
- 2번 없음 → 재빌드 필요
- 3번 없음 → Claude Desktop 재시작 필요

## 🎯 빠른 해결 (한 번에)

```batch
@echo off
echo ===== 1. Git 최신 코드 받기 =====
cd C:\Users\erica\Desktop\jeromspace\eve-mcp
git pull origin main

echo.
echo ===== 2. 소스 코드 확인 =====
findstr "CODE VERSION" src\adams-real-improved.ts
if %errorlevel% neq 0 (
    echo ❌ 소스 코드가 업데이트 안 됨!
    echo Git pull을 다시 확인하세요.
    pause
    exit /b 1
)

echo.
echo ===== 3. 프로세스 종료 =====
taskkill /f /im Claude.exe 2>nul
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo.
echo ===== 4. 재빌드 =====
rmdir /s /q build
npm run build

echo.
echo ===== 5. 빌드 확인 =====
findstr "CODE VERSION" build\adams-real-improved.js
if %errorlevel% equ 0 (
    echo ✅ 빌드 성공!
) else (
    echo ❌ 빌드 파일에 버전 없음!
    pause
    exit /b 1
)

echo.
echo ===== 완료 =====
echo Claude Desktop을 재시작하고 검색을 테스트하세요.
echo.
pause
```

위 내용을 `update-and-rebuild.bat`로 저장 후 실행하세요.

## 🔥 핵심 포인트

1. **Git clone을 한 시점이 중요**:
   - 제가 코드를 푸시한 시각: 약 2시간 전
   - 윈도우 사용자가 clone한 시각: ?
   - → **Git pull로 최신 코드 받아야 함**

2. **빌드만으로는 부족**:
   - 옛날 소스 코드를 빌드하면 → 옛날 빌드 파일
   - **소스 코드 업데이트 후 빌드**해야 함

3. **3단계 확인**:
   1. 소스 파일에 "CODE VERSION" 있나?
   2. 빌드 파일에 "CODE VERSION" 있나?
   3. 로그 파일에 "CODE VERSION" 있나?
   - **셋 다 있어야 함!**

---

**추가 문제 발생 시**:
- 진단 결과 (3개 파일 확인 결과)
- Git pull 실행 결과
- 로그 파일 전체

위 정보를 보내주세요.
