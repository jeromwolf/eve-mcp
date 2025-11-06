@echo off
echo ========================================
echo eve-mcp 강제 재빌드 (Force Rebuild)
echo ========================================
echo.

:: 현재 경로 확인
echo [1/7] 현재 작업 디렉토리:
cd
echo.

:: 프로세스 종료
echo [2/7] Claude 및 Node 프로세스 종료...
taskkill /f /im Claude.exe 2>nul
taskkill /f /im node.exe 2>nul
taskkill /f /im chrome.exe 2>nul
timeout /t 3 /nobreak >nul
echo ✅ 프로세스 종료 완료
echo.

:: build 폴더 완전 삭제
echo [3/7] 기존 build 폴더 삭제...
if exist build (
    rmdir /s /q build
    if exist build (
        echo ❌ build 폴더 삭제 실패!
        echo 관리자 권한으로 CMD를 실행하세요.
        pause
        exit /b 1
    )
    echo ✅ build 폴더 삭제 완료
) else (
    echo ⚠️ build 폴더가 없습니다 (정상)
)
echo.

:: node_modules 재설치 (선택)
echo [4/7] 의존성 설치...
echo (npm install 실행 중... 시간이 걸릴 수 있습니다)
call npm install >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm install 실패!
    pause
    exit /b 1
)
echo ✅ 의존성 설치 완료
echo.

:: TypeScript 빌드
echo [5/7] TypeScript 컴파일...
echo (npm run build 실행 중...)
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 빌드 실패!
    pause
    exit /b 1
)
echo ✅ 빌드 완료
echo.

:: 버전 확인
echo [6/7] 빌드 버전 확인...
findstr /C:"CODE VERSION: 2025-11-06-v2" build\adams-real-improved.js >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 버전 확인 성공!
    echo.
    echo 빌드 파일에서 발견:
    findstr /C:"CODE VERSION" build\adams-real-improved.js
) else (
    echo ❌ 버전 마커를 찾을 수 없습니다!
    echo build\adams-real-improved.js 파일을 확인하세요.
    pause
    exit /b 1
)
echo.

:: 파일 날짜 확인
echo [7/7] 빌드 파일 날짜 확인...
dir /TC build\adams-real-improved.js | findstr "adams-real-improved.js"
echo.

:: 완료
echo ========================================
echo ✅ 재빌드 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. Claude Desktop을 재시작하세요
echo 2. "small modular reactor 검색해줘" 테스트
echo 3. 로그 확인: logs\mcp\mcp-server-*.log
echo 4. 로그에 "CODE VERSION: 2025-11-06-v2" 있는지 확인
echo.
echo 로그 확인 명령어:
echo type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
echo.
pause
