# NRC ADAMS MCP 서버 테스트 시나리오

## 1. MCP 서버 설정 테스트

### 1.1 Claude Desktop 설정
```bash
# 1. Claude Desktop 설정 파일 열기
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 2. 다음 설정 추가
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/blockmeta/Desktop/blockmeta/project/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",  // OpenAI API 키 (선택사항)
        "ANTHROPIC_API_KEY": "sk-..."  // Claude API 키 (선택사항)
      }
    }
  }
}

# 3. Claude Desktop 재시작
```

### 1.2 서버 연결 확인
```bash
# 서버 직접 테스트
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js
```

## 2. 검색 기능 테스트

### 2.1 기본 검색
**Claude Desktop에서:**
```
"safety analysis 2024"로 ADAMS 검색해줘
```

**예상 결과:**
- 10개의 문서 검색
- ML24270A144 등 실제 문서번호 표시
- 검색 결과 캐시 상태 표시

### 2.2 다양한 검색어 테스트
```
1. "emergency plan" 검색
2. "safety" 검색
3. "reactor" 검색
4. "inspection report 2024" 검색
```

### 2.3 검색 결과 확인
- 각 검색어마다 실제 ML 번호들이 나오는지 확인
- 중복 검색 시 캐시가 대체되는지 확인

## 3. 다운로드 기능 테스트

### 3.1 상위 N개 다운로드
```
검색 결과에서 상위 5개 다운로드해줘
```

**예상 결과:**
- 5개 PDF 다운로드 성공
- downloaded_pdfs 폴더에 저장
- 각 파일 크기 표시

### 3.2 특정 문서 다운로드
```
1번, 3번, 5번 문서만 다운로드해줘
```

### 3.3 특정 문서번호 다운로드
```
ML24275A095 다운로드해줘
```

## 4. 문서 Q&A 테스트

### 4.1 기본 질문
```
다운로드한 문서에서 "safety"에 대해 찾아줘
```

### 4.2 복잡한 질문
```
다운로드한 문서에서 inspection findings 요약해줘
```

### 4.3 RAG 엔진 테스트
**OpenAI API 키가 있는 경우:**
- 벡터 임베딩 기반 검색
- 더 정확한 의미 검색

**API 키가 없는 경우:**
- 키워드 기반 검색
- 단락 관련성 점수 계산

## 5. 캐시 관리 테스트

### 5.1 캐시 상태 확인
```
다운로드한 문서 목록 보여줘
```

**예상 결과:**
- 캐시된 문서 수
- 각 문서 정보 (제목, 크기, 날짜)
- 캐시 사용률 (예: 15/50)

### 5.2 캐시 비우기
```
캐시 비워줘
```
또는
```
다운로드한 파일 모두 지워줘
```

### 5.3 LRU 캐시 테스트
- 50개 이상 다운로드 시도
- 오래된 문서가 자동 삭제되는지 확인

## 6. 통합 시나리오 테스트

### 시나리오 1: 안전 분석 문서 조사
```
1. "safety analysis 2024" 검색
2. 상위 10개 다운로드
3. "design basis accident"에 대해 찾아줘
4. 찾은 내용 요약해줘
```

### 시나리오 2: 특정 원전 조사
```
1. "Vogtle" 검색
2. 최근 문서 5개 다운로드
3. "inspection findings" 찾아줘
4. 중요한 발견사항 정리해줘
```

### 시나리오 3: 규제 요건 확인
```
1. "regulatory guide" 검색
2. 관련 문서 다운로드
3. "compliance requirements" 찾아줘
4. 주요 요구사항 목록 만들어줘
```

## 7. 오류 처리 테스트

### 7.1 잘못된 검색어
```
"" 검색 (빈 문자열)
```

### 7.2 다운로드 실패
```
ML00000000 다운로드 (존재하지 않는 문서)
```

### 7.3 네트워크 오류
- 인터넷 연결 끊고 테스트
- 타임아웃 처리 확인

## 8. 성능 테스트

### 8.1 대량 다운로드
```
상위 20개 문서 다운로드
```
- 다운로드 속도 확인
- 메모리 사용량 확인

### 8.2 대용량 PDF 처리
- 100MB 이상 PDF 다운로드 시도
- 텍스트 추출 성능 확인

## 9. 검증 체크리스트

- [ ] API 500 에러 시 브라우저 폴백 작동
- [ ] 실제 ML 번호 검색 (모의 데이터 없음)
- [ ] PDF 다운로드 성공 (실제 파일)
- [ ] downloaded_pdfs 폴더에 저장
- [ ] 캐시 관리 정상 작동
- [ ] Q&A 기능 정상 작동
- [ ] 에러 메시지 명확함
- [ ] 한글/영어 혼용 가능

## 10. 로그 확인

### 터미널에서 확인할 내용:
```
[REAL ADAMS] Searching for: "safety"
[REAL ADAMS] API failed with 500, using browser fallback...
[REAL ADAMS] Found 25 unique ML numbers
[REAL ADAMS] Downloading: ML24270A144
[REAL ADAMS] ✓ Saved real PDF to: ./downloaded_pdfs/ML24270A144.pdf
```

## 테스트 완료 기준

1. **검색**: 실제 ADAMS 문서번호 반환
2. **다운로드**: 실제 PDF 파일 저장 
3. **Q&A**: 다운로드한 문서에서 정보 추출
4. **캐시**: 50개 제한, LRU 방식 작동
5. **오류 처리**: 명확한 에러 메시지

---

## 빠른 테스트 명령어

Claude Desktop에서 순서대로 실행:

```
1. "safety analysis 2024" 검색해줘
2. 상위 3개 다운로드해줘
3. 다운로드한 문서에서 "inspection" 찾아줘
4. 캐시 상태 보여줘
5. 캐시 비워줘
```

모든 명령이 정상 작동하면 테스트 성공! ✅