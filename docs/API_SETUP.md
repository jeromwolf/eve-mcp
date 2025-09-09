# API 설정 가이드 (RAG 기능 활성화)

## 🚀 RAG(Retrieval-Augmented Generation) 기능

RAG를 활성화하면 단순 키워드 검색이 아닌 **AI 기반 의미 검색**이 가능합니다!

### 차이점:

#### ❌ 키워드 검색 (기본)
- "emergency plan" 검색 → "emergency"와 "plan" 단어가 있는 문장만 찾음
- 동의어 인식 못함
- 문맥 이해 못함

#### ✅ RAG 검색 (AI API 사용시)
- "emergency response" 검색 → "disaster plan", "safety procedures" 등 의미적으로 관련된 내용 모두 찾음
- 문맥 기반 검색
- 더 정확한 결과

## 🔑 API 키 선택 (둘 중 하나만 있어도 됨!)

### 옵션 1: OpenAI API 키 사용 (추천)
**장점:** 벡터 임베딩으로 가장 정확한 검색
**비용:** $0.0001 / 1K tokens (매우 저렴)

#### 발급 방법:
1. [OpenAI Platform](https://platform.openai.com) 접속
2. 계정 생성 또는 로그인
3. [API Keys 페이지](https://platform.openai.com/api-keys) 이동
4. "Create new secret key" 클릭
5. 키 복사 (sk-...)

### 옵션 2: Claude API 키 사용
**장점:** Claude 사용자는 추가 가입 불필요
**비용:** Haiku 모델 사용 (저렴)

#### 발급 방법:
1. [Anthropic Console](https://console.anthropic.com) 접속
2. 계정 생성 또는 로그인
3. API Keys 섹션 이동
4. "Create Key" 클릭
5. 키 복사 (sk-ant-...)

## ⚙️ Claude Desktop 설정

### 1. 설정 파일 열기
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### 2. API 키 추가 (하나만 선택)

#### OpenAI만 사용하는 경우:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/blockmeta/Desktop/blockmeta/project/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-여기에_OpenAI_API_키_입력"
      }
    }
  }
}
```

#### Claude만 사용하는 경우:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/blockmeta/Desktop/blockmeta/project/eve-mcp/build/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-여기에_Claude_API_키_입력"
      }
    }
  }
}
```

#### 둘 다 사용하는 경우 (OpenAI 우선):
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/blockmeta/Desktop/blockmeta/project/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-여기에_OpenAI_API_키_입력",
        "ANTHROPIC_API_KEY": "sk-ant-여기에_Claude_API_키_입력"
      }
    }
  }
}
```

### 3. Claude Desktop 재시작
1. Claude Desktop 완전 종료 (Cmd + Q)
2. Claude Desktop 다시 실행

## 🔍 RAG 활성화 확인

문서 다운로드 후 질문하면 다음과 같이 표시됩니다:

### OpenAI API 사용시:
```
🔍 AI-Powered Search Results for "emergency plan":
📄 [ML24001234] Emergency Response Plan
(Relevance: 92.3%)
...

📊 Search Info:
- Method: Semantic Search (RAG)
- Documents searched: 10
- Total chunks: 150
- ✅ OpenAI embeddings active
```

### Claude API 사용시:
```
🔍 AI-Powered Search Results for "emergency plan":
📄 [ML24001234] Emergency Response Plan
(Relevance: 85.7%)
...

📊 Search Info:
- Method: Semantic Search (RAG)
- Documents searched: 10
- Total chunks: 150
- ✅ Claude/Anthropic analysis active
```

### API 키 없을 때:
```
🔍 Keyword Search Results for "emergency plan":
📄 [ML24001234] Emergency Response Plan
...

📊 Search Info:
- Method: Keyword Matching
- Documents searched: 10
- Total chunks: 150
- ⚠️ Add API key for better results
```

## 💰 비용 비교

| API Provider | 모델 | 비용 | 100개 문서 예상 비용 |
|-------------|------|------|-------------------|
| OpenAI | text-embedding-ada-002 | $0.0001/1K tokens | $0.10~$0.50 |
| Claude | claude-3-haiku | $0.25/1M input tokens | $0.50~$1.00 |
| 없음 (키워드) | - | 무료 | $0 |

## ❓ 자주 묻는 질문

**Q: 꼭 API 키가 필요한가요?**
A: 아니요! API 키 없이도 키워드 검색으로 작동합니다. RAG은 선택사항입니다.

**Q: OpenAI와 Claude 중 어느 것이 더 좋나요?**
A: OpenAI가 임베딩 기반이라 약간 더 정확하지만, 둘 다 우수한 성능을 보입니다.

**Q: 두 API 키를 모두 설정하면?**
A: OpenAI가 우선 사용되고, 실패시 Claude로 자동 전환됩니다.

**Q: API 키가 안전한가요?**
A: Claude Desktop 로컬 설정에만 저장되며, 외부로 전송되지 않습니다.

## 🔧 문제 해결

### API 키 인식 안됨
1. 키 형식 확인:
   - OpenAI: "sk-"로 시작
   - Claude: "sk-ant-"로 시작
2. 따옴표 안에 정확히 입력했는지 확인
3. Claude Desktop 재시작

### 검색 결과가 부정확함
1. API 키가 올바르게 설정되었는지 확인
2. 계정에 크레딧이 있는지 확인
3. 네트워크 연결 확인

## 🎯 추천 사용 사례

### RAG 필요한 경우:
- 복잡한 기술 문서 분석
- 의미 기반 검색 ("안전성 평가" → "safety analysis" 찾기)
- 문맥 이해가 필요한 질문

### 키워드로 충분한 경우:
- 문서 번호로 검색 (ML24001234)
- 특정 정확한 용어 찾기
- 간단한 키워드 매칭