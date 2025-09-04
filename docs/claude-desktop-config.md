# Claude Desktop 설정 가이드

## 1. MCP 서버 준비

먼저 터미널에서 EVE MCP를 빌드합니다:

```bash
cd /Volumes/samsungSSD/kelly_project/eve-mcp
npm install
npm run build
```

## 2. Claude Desktop 설정

Claude Desktop의 설정 파일을 수정해야 합니다.

### macOS 설정 위치
`~/Library/Application Support/Claude/claude_desktop_config.json`

### 설정 파일 내용

```json
{
  "mcpServers": {
    "eve-mcp": {
      "command": "node",
      "args": ["/Volumes/samsungSSD/kelly_project/eve-mcp/build/index.js"]
    }
  }
}
```

## 3. Claude Desktop 재시작

설정을 저장한 후 Claude Desktop을 완전히 종료하고 다시 시작합니다.

## 4. 사용 확인

Claude Desktop에서 다음과 같이 테스트해보세요:

1. **논문 검색 테스트**
   ```
   "transformer architecture 관련 최신 논문 5개 검색해줘"
   ```

2. **PDF 다운로드 테스트**
   ```
   "첫 번째 논문의 PDF를 다운로드해줘"
   ```

3. **질의응답 테스트**
   ```
   "다운로드한 PDF에서 self-attention이 어떻게 설명되어 있는지 알려줘"
   ```

## 문제 해결

### MCP가 연결되지 않을 때
1. 설정 파일 경로가 정확한지 확인
2. node가 설치되어 있는지 확인 (`node --version`)
3. build 폴더가 생성되었는지 확인

### 로그 확인
Claude Desktop의 개발자 도구(Cmd+Option+I)에서 콘솔 로그를 확인할 수 있습니다.