# EVE MCP 설치 가이드

## 사전 요구사항

### 1. Node.js 설치

#### Windows
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 프로그램 실행 (기본 설정으로 진행)
3. 설치 확인:
   ```cmd
   node --version
   npm --version
   ```

#### macOS
1. Homebrew 사용:
   ```bash
   brew install node
   ```
   또는 [Node.js 공식 사이트](https://nodejs.org/)에서 다운로드

2. 설치 확인:
   ```bash
   node --version
   npm --version
   ```

#### Linux
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 설치 확인
node --version
npm --version
```

### 2. Git 설치 (선택사항)

#### Windows
- [Git for Windows](https://git-scm.com/download/win) 다운로드 및 설치

#### macOS
```bash
brew install git
```

#### Linux
```bash
sudo apt-get install git  # Ubuntu/Debian
```

## EVE MCP 설치

### 방법 1: Git Clone (권장)

```bash
# 원하는 디렉토리로 이동
cd ~/Documents  # 또는 원하는 위치

# 저장소 복제
git clone https://github.com/jeromwolf/eve-mcp.git

# 프로젝트 디렉토리로 이동
cd eve-mcp

# 의존성 설치
npm install

# 빌드
npm run build
```

### 방법 2: 수동 다운로드

1. [GitHub 저장소](https://github.com/jeromwolf/eve-mcp)에서 ZIP 다운로드
2. 원하는 위치에 압축 해제
3. 터미널/명령 프롬프트에서:
   ```bash
   cd [압축 해제한 폴더 경로]
   npm install
   npm run build
   ```

## Claude Desktop 설정

### 설정 파일 위치

#### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```
실제 경로: `C:\Users\[사용자명]\AppData\Roaming\Claude\claude_desktop_config.json`

#### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```
실제 경로: `/Users/[사용자명]/Library/Application Support/Claude/claude_desktop_config.json`

#### Linux
```
~/.config/claude/claude_desktop_config.json
```

### 설정 파일 수정

1. **설정 파일 열기**

   #### Windows (PowerShell)
   ```powershell
   notepad $env:APPDATA\Claude\claude_desktop_config.json
   ```
   
   #### macOS/Linux
   ```bash
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **설정 내용 추가**

   ```json
   {
     "mcpServers": {
       "eve-mcp": {
         "command": "node",
         "args": ["[EVE-MCP 설치 경로]/build/index.js"]
       }
     }
   }
   ```

3. **경로 예시**

   #### Windows
   ```json
   {
     "mcpServers": {
       "eve-mcp": {
         "command": "node",
         "args": ["C:/Users/사용자명/Documents/eve-mcp/build/index.js"]
       }
     }
   }
   ```

   #### macOS
   ```json
   {
     "mcpServers": {
       "eve-mcp": {
         "command": "node",
         "args": ["/Users/사용자명/Documents/eve-mcp/build/index.js"]
       }
     }
   }
   ```

   #### Linux
   ```json
   {
     "mcpServers": {
       "eve-mcp": {
         "command": "node",
         "args": ["/home/사용자명/eve-mcp/build/index.js"]
       }
     }
   }
   ```

## 설치 확인

### 1. MCP 서버 테스트

#### Windows (cmd)
```cmd
cd C:\Users\사용자명\Documents\eve-mcp
echo {"jsonrpc":"2.0","method":"tools/list","id":1} | node build\index.js
```

#### macOS/Linux
```bash
cd ~/Documents/eve-mcp
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js
```

정상 작동 시 도구 목록이 JSON 형식으로 출력됩니다.

### 2. Claude Desktop 확인

1. Claude Desktop 완전히 종료
2. 다시 실행
3. 하단에 "eve-mcp" 표시 확인
4. 테스트: "machine learning 논문 검색해줘"

## 문제 해결

### Node.js를 찾을 수 없음

#### Windows
```json
{
  "mcpServers": {
    "eve-mcp": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["C:/Users/사용자명/Documents/eve-mcp/build/index.js"]
    }
  }
}
```

#### macOS (Homebrew)
```json
{
  "mcpServers": {
    "eve-mcp": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/사용자명/Documents/eve-mcp/build/index.js"]
    }
  }
}
```

### 경로에 공백이 있는 경우

#### Windows
```json
"args": ["C:/Users/사용자 이름/My Documents/eve-mcp/build/index.js"]
```
주의: 따옴표를 추가로 넣지 마세요. JSON이 자동으로 처리합니다.

### MCP 연결 안됨

1. **로그 확인**
   - Claude Desktop에서 개발자 도구 열기 (Cmd/Ctrl+Option+I)
   - Console 탭에서 오류 확인

2. **일반적인 해결책**
   - Claude Desktop 완전 재시작
   - 경로가 정확한지 확인
   - build 폴더가 생성되었는지 확인
   - Node.js가 제대로 설치되었는지 확인

## 업데이트

```bash
# 프로젝트 폴더로 이동
cd eve-mcp

# 최신 버전 가져오기
git pull

# 의존성 업데이트
npm install

# 다시 빌드
npm run build
```

## 제거

1. Claude Desktop 설정에서 eve-mcp 항목 제거
2. eve-mcp 폴더 삭제

---

문제가 계속되면 [GitHub Issues](https://github.com/jeromwolf/eve-mcp/issues)에 문의해주세요.