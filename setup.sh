#!/bin/bash

echo "EVE MCP 설치 도우미"
echo "=================="
echo

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "[오류] Node.js가 설치되지 않았습니다!"
    echo "https://nodejs.org/ 에서 다운로드하거나"
    echo "macOS: brew install node"
    echo "Ubuntu: sudo apt-get install nodejs"
    exit 1
fi

echo "[확인] Node.js $(node --version) 설치됨"
echo

# 의존성 설치
echo "의존성 설치 중..."
npm install
if [ $? -ne 0 ]; then
    echo "[오류] 의존성 설치 실패!"
    exit 1
fi

# 빌드
echo
echo "TypeScript 빌드 중..."
npm run build
if [ $? -ne 0 ]; then
    echo "[오류] 빌드 실패!"
    exit 1
fi

# 현재 경로
CURRENT_PATH=$(pwd)

# OS 확인
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
    CONFIG_PATH="$HOME/.config/claude/claude_desktop_config.json"
fi

echo
echo "========================================"
echo "설치가 완료되었습니다!"
echo "========================================"
echo
echo "Claude Desktop 설정 방법:"
echo
echo "1. 다음 파일을 여세요:"
echo "   $CONFIG_PATH"
echo
echo "2. 다음 내용을 추가하세요:"
cat << EOF
{
  "mcpServers": {
    "eve-mcp": {
      "command": "node",
      "args": ["$CURRENT_PATH/build/index.js"]
    }
  }
}
EOF
echo
echo "3. Claude Desktop을 재시작하세요."
echo
echo "========================================