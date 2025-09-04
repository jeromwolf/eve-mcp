@echo off
echo EVE MCP Windows 설치 도우미
echo ========================
echo.

:: Node.js 확인
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되지 않았습니다!
    echo https://nodejs.org/ 에서 다운로드하세요.
    pause
    exit /b 1
)

echo [확인] Node.js가 설치되어 있습니다.
echo.

:: 의존성 설치
echo 의존성 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo [오류] 의존성 설치 실패!
    pause
    exit /b 1
)

:: 빌드
echo.
echo TypeScript 빌드 중...
call npm run build
if %errorlevel% neq 0 (
    echo [오류] 빌드 실패!
    pause
    exit /b 1
)

:: 현재 경로 가져오기
set CURRENT_PATH=%CD%

echo.
echo ========================================
echo 설치가 완료되었습니다!
echo ========================================
echo.
echo Claude Desktop 설정 방법:
echo.
echo 1. 다음 파일을 메모장으로 여세요:
echo    %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo 2. 다음 내용을 추가하세요:
echo {
echo   "mcpServers": {
echo     "eve-mcp": {
echo       "command": "node",
echo       "args": ["%CURRENT_PATH%\build\index.js"]
echo     }
echo   }
echo }
echo.
echo 3. Claude Desktop을 재시작하세요.
echo.
echo ========================================
pause