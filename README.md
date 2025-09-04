# EVE MCP Server

EVE (Enhanced Virtual Environment) MCP Server는 Claude 환경에서 학술 논문 PDF를 검색하고 질의응답할 수 있는 MCP 서버입니다.

## 주요 기능

1. **논문 검색**: arXiv에서 키워드로 논문 검색
2. **PDF 다운로드**: PDF 문서 다운로드 및 텍스트 추출
3. **질의응답**: 다운로드한 PDF에 대한 질문-답변

## 설치 방법

```bash
# 의존성 설치
npm install

# TypeScript 빌드
npm run build
```

## Claude Desktop 설정

Claude Desktop의 MCP 설정에 다음을 추가하세요:

```json
{
  "mcpServers": {
    "eve-mcp": {
      "command": "node",
      "args": ["/path/to/eve-mcp/build/index.js"]
    }
  }
}
```

## 사용 예시

### 1. 논문 검색

#### 기본 검색 (arXiv)
```
"machine learning 논문 검색해줘"
"transformer architecture 관련 논문 찾아줘"
"attention mechanism 최신 논문 5개"
"BERT 논문 검색"
```

#### PubMed 검색 (의학/생명과학)
```
"PubMed에서 COVID-19 vaccine 논문 검색해줘"
"pubmed에서 cancer immunotherapy 최신 논문 10개"
"PubMed에서 alzheimer treatment 연구 찾아줘"
"pubmed에서 CRISPR gene editing 논문 3개"
```

#### 검색 개수 지정
```
"deep learning 논문 3개만 검색해줘"
"PubMed에서 diabetes 논문 20개 찾아줘"
```

#### 복잡한 검색어
```
"attention is all you need 논문 찾아줘"
"large language model fine-tuning 관련 논문"
"COVID-19 mRNA vaccine effectiveness 연구"
```

### 2. PDF 다운로드

#### URL로 직접 다운로드
```
"https://arxiv.org/pdf/1706.03762.pdf 다운로드해줘"
"http://arxiv.org/pdf/1810.04805.pdf 다운로드"
```

#### 검색 결과에서 번호로 다운로드
```
"GPT 논문 검색해줘"
"1번 논문 다운로드"  # 첫 번째 검색 결과
"3번도 다운로드해줘"  # 세 번째 검색 결과
```

#### 여러 논문 다운로드
```
"reinforcement learning 논문 5개 검색"
"1번, 3번, 5번 논문 다운로드해줘"
```

### 3. PDF 질의응답

#### 최근 PDF에 질문 (파일명 없이)
```
"이 논문의 핵심 contribution이 뭐야?"
"주요 실험 결과를 요약해줘"
"limitation이나 future work 섹션 있어?"
"논문의 methodology 설명해줘"
```

#### 파일명으로 특정 PDF 지정
```
"1706.03762.pdf에서 self-attention 메커니즘 설명해줘"
"bert_paper.pdf에서 pre-training 과정 찾아줘"
"covid_vaccine.pdf에서 효과성 데이터 보여줘"
```

#### 구체적인 내용 찾기
```
"transformer 아키텍처 그림 설명해줘"
"실험에 사용된 데이터셋이 뭐야?"
"hyperparameter 설정값들 알려줘"
"이 논문에서 인용한 BERT 논문 정보"
```

#### 비교 질문
```
"이 모델의 장점과 단점은?"
"기존 방법과 어떤 차이가 있어?"
"성능 향상이 얼마나 됐어?"
```

### 4. PDF 목록 관리

#### 목록 확인
```
"다운로드한 PDF 목록 보여줘"
"현재 저장된 논문들 뭐가 있어?"
```

#### 특정 PDF 정보
```
"transformer.pdf 정보 알려줘"
"가장 최근에 다운로드한 PDF는?"
```

### 5. 복합 시나리오 예제

#### 시나리오 1: 특정 주제 연구
```
1. "PubMed에서 COVID-19 vaccine side effects 논문 10개 검색"
2. "1번이랑 3번 논문 다운로드해줘"
3. "첫 번째 논문에서 주요 부작용 종류 알려줘"
4. "두 번째 논문에서는 같은 내용 어떻게 설명해?"
5. "두 논문의 결론 비교해줘"
```

#### 시나리오 2: 최신 기술 조사
```
1. "transformer 기반 최신 모델 논문 검색"
2. "가장 최근 논문 3개 다운로드"
3. "각 논문의 핵심 아이디어 요약해줘"
4. "성능 비교 표 있으면 보여줘"
```

#### 시나리오 3: 문헌 리뷰
```
1. "machine learning in healthcare 논문 15개 검색"
2. "1번부터 5번까지 다운로드"
3. "각 논문의 application area 정리해줘"
4. "공통적으로 언급되는 challenge는?"
```

### 6. 한국어 질문 예제

```
"이 논문의 핵심이 뭐야?"
"실험 결과 요약해줘"
"어떤 데이터셋 썼어?"
"이 방법의 한계점은?"
"future work으로 뭘 제안해?"
```

### 7. 오류 처리

#### 다운로드 실패 시
```
"다시 다운로드 시도해줘"
"다른 URL 형식으로 해볼게: https://..."
```

#### PDF를 찾을 수 없을 때
```
"다운로드한 PDF 목록 확인"
"[정확한 파일명]으로 다시 질문"
```

## 개발

```bash
# 개발 모드 실행
npm run dev

# 테스트
npm test

# 린트
npm run lint
```

## 제한사항

- PDF 크기: 최대 50MB
- 지원 사이트: arXiv, PubMed (Google Scholar는 API 키 필요)
- 텍스트 추출: 이미지나 표의 텍스트는 추출되지 않을 수 있음

## 라이센스

MIT License