@echo off
echo ========================================
echo eve-mcp 업데이트 및 재빌드
echo ========================================
echo.

:: 현재 경로 확인
echo [현재 디렉토리]
cd
echo.

:: 1. Git 최신 코드 받기
echo [1/6] Git에서 최신 코드 받기...
git pull origin main
if %errorlevel% neq 0 (
    echo ⚠️ Git pull 실패. git status 확인 중...
    git status
    echo.
    echo 로컬 변경사항이 있다면:
    echo   git reset --hard
    echo   git pull origin main
    pause
    exit /b 1
)
echo ✅ Git pull 완료
echo.

:: 2. 소스 코드 확인
echo [2/6] 소스 코드 버전 확인...
findstr /C:"CODE VERSION: 2025-11-06-v2" src\adams-real-improved.ts >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 소스 코드에 버전 마커 없음!
    echo.
    echo 소스 파일 내용 확인:
    findstr /C:"CODE VERSION" src\adams-real-improved.ts
    echo.
    echo Git pull이 제대로 되지 않았습니다.
    echo 위 출력에 "2025-11-06-v2"가 없으면 문제입니다.
    pause
    exit /b 1
)
echo ✅ 소스 코드 버전 확인 완료
findstr /C:"CODE VERSION" src\adams-real-improved.ts
echo.

:: 3. 프로세스 종료
echo [3/6] Claude 및 Node 프로세스 종료...
taskkill /f /im Claude.exe 2>nul
taskkill /f /im node.exe 2>nul
taskkill /f /im chrome.exe 2>nul
timeout /t 3 /nobreak >nul
echo ✅ 프로세스 종료 완료
echo.

:: 4. build 폴더 삭제
echo [4/6] 기존 build 폴더 삭제...
if exist build (
    rmdir /s /q build
    if exist build (
        echo ❌ build 폴더 삭제 실패!
        echo 관리자 권한으로 실행하거나 수동으로 삭제하세요.
        pause
        exit /b 1
    )
    echo ✅ build 폴더 삭제 완료
) else (
    echo ℹ️ build 폴더 없음 (정상)
)
echo.

:: 5. 재빌드
echo [5/6] TypeScript 빌드 중...
echo (시간이 걸릴 수 있습니다...)
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 빌드 실패!
    pause
    exit /b 1
)
echo ✅ 빌드 완료
echo.

:: 6. 빌드 파일 확인
echo [6/6] 빌드 파일 버전 확인...
findstr /C:"CODE VERSION: 2025-11-06-v2" build\adams-real-improved.js >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 빌드 파일에 버전 마커 없음!
    echo.
    echo 빌드 파일 내용 확인:
    findstr /C:"CODE VERSION" build\adams-real-improved.js
    echo.
    echo 빌드는 성공했지만 버전이 맞지 않습니다.
    pause
    exit /b 1
)
echo ✅ 빌드 파일 버전 확인 완료
findstr /C:"CODE VERSION" build\adams-real-improved.js
echo.

:: 완료
echo ========================================
echo ✅ 모든 단계 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. Claude Desktop을 재시작하세요
echo 2. "small modular reactor 검색해줘" 테스트
echo.
echo 검색 후 로그 확인:
echo   type logs\mcp\mcp-server-*.log ^| findstr "CODE VERSION"
echo.
echo 로그에 "CODE VERSION: 2025-11-06-v2"가 있어야 합니다.
echo.
pause
