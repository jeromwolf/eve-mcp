# 🎯 NRC ADAMS MCP 정확도 테스트 가이드

## 개요

NRC ADAMS MCP 서버의 답변 정확도를 체계적으로 측정하고 평가하는 방법론을 제시합니다.

## 📊 정확도 평가 방법론

### 1. 평가 지표 (Evaluation Metrics)

#### A. 키워드 일치도 (Keyword Match Score)
- **측정**: 예상 키워드 대비 실제 답변에 포함된 키워드 비율
- **점수**: 0-1 (1이 최고)
- **계산**: 일치한 키워드 수 / 전체 예상 키워드 수

```javascript
// 예시: "reactor safety" 질문
expectedKeywords: ['safety systems', 'containment', 'emergency core cooling']
answer: "Nuclear reactors have multiple safety systems including containment..."
score: 2/3 = 0.67 (67%)
```

#### B. 출처 관련성 (Source Relevance Score)  
- **측정**: 인용된 문서가 질문 주제와 얼마나 관련이 있는지
- **점수**: 0-1 (1이 최고)
- **계산**: 관련 출처 수 / 전체 예상 출처 수

```javascript
// 예시: 규제 관련 질문
expectedSources: ['10 CFR Part 50', 'NUREG', 'safety evaluation']
citations: ['10 CFR Part 50.46', 'Technical Specification'] 
score: 1/3 = 0.33 (33%)
```

#### C. 답변 완성도 (Completeness Score)
- **측정**: 답변의 길이, 구조, 포괄성
- **요소**:
  - 길이 점수 (50-500자 적절)
  - 구조 점수 (목록, 문단 구분)  
  - 키워드 밀도

#### D. 종합 정확도 점수 (Overall Accuracy Score)
- **가중 평균**: 
  - 키워드 일치도 40%
  - 출처 관련성 30%
  - 답변 완성도 30%

### 2. Ground Truth 데이터셋

#### 테스트 카테고리
1. **안전 요구사항** (Safety Requirements)
2. **응급 계획** (Emergency Planning)  
3. **규제 프레임워크** (Regulations)
4. **기술 사양** (Technical Specifications)
5. **신기술** (New Technology - SMR 등)

#### 난이도 분류
- **Basic**: 일반적인 개념, 정의
- **Intermediate**: 구체적 절차, 요구사항
- **Advanced**: 복합적 분석, 비교

## 🧪 테스트 실행 방법

### 1. 자동화된 정확도 테스트

```bash
# 전체 정확도 평가 실행
node tests/test-accuracy-evaluation.js

# 결과 파일 위치
ls test-results/accuracy-test-*.json
```

### 2. 수동 평가 방법

#### A. 전문가 리뷰 (Expert Review)
```bash
# 1. 테스트 질문에 대한 답변 생성
echo "What are reactor safety requirements?" | your_mcp_tool

# 2. 답변을 nuclear 전문가에게 리뷰 요청
# 3. 1-5 척도로 평가:
#    5 = 완전히 정확하고 포괄적
#    4 = 대부분 정확, 사소한 누락
#    3 = 부분적으로 정확
#    2 = 부정확한 내용 포함
#    1 = 완전히 부정확
```

#### B. 문서 검증 (Document Verification)
```bash
# 1. 인용된 문서들을 실제 NRC 사이트에서 확인
# 2. 답변 내용이 원문과 일치하는지 검증
# 3. 맥락이 올바르게 해석되었는지 확인
```

### 3. A/B 테스트 방법

#### 설정 비교
```bash
# API 키 있음 vs 없음
OPENAI_API_KEY=sk-... node tests/test-accuracy-evaluation.js > with_api.log
unset OPENAI_API_KEY && node tests/test-accuracy-evaluation.js > without_api.log

# 결과 비교
diff with_api.log without_api.log
```

## 📈 결과 해석 가이드

### 점수 기준

#### 종합 정확도 점수
- **90-100%**: 탁월한 성능 - 전문가 수준
- **80-89%**: 우수한 성능 - 실용적 활용 가능  
- **70-79%**: 양호한 성능 - 보조 도구로 활용
- **60-69%**: 보통 성능 - 개선 필요
- **60% 미만**: 부족한 성능 - 대폭 개선 필요

#### 카테고리별 기대 성능
- **안전 요구사항**: 85%+ (풍부한 문서)
- **규제 프레임워크**: 90%+ (명확한 규정)
- **기술 사양**: 75%+ (복잡한 기술 내용)
- **응급 계획**: 80%+ (표준화된 절차)
- **신기술 (SMR)**: 70%+ (상대적으로 적은 문서)

### 개선 방향

#### 낮은 키워드 일치도 → 검색 알고리즘 개선
```bash
# 더 다양한 동의어, 관련 용어 포함
# 임베딩 모델 튜닝
# 검색 쿼리 확장
```

#### 낮은 출처 관련성 → 문서 필터링 강화
```bash  
# 문서 품질 스코어링 도입
# 최신 문서 우선순위
# 공식 문서 가중치 증가
```

#### 낮은 완성도 → 답변 생성 로직 개선
```bash
# 여러 문서 종합 능력 향상
# 구조화된 답변 템플릿
# 길이 최적화
```

## 🔧 지속적인 품질 관리

### 1. 정기 테스트 스케줄
```bash
# 매주 정확도 테스트 실행
0 0 * * 0 cd /path/to/nrc-adams-mcp && node tests/test-accuracy-evaluation.js

# 결과를 팀에 자동 리포트
# 성능 저하 감지 시 알림
```

### 2. 신규 문서 업데이트 시 테스트
```bash
# 새 NRC 문서가 추가될 때마다
# 기존 질문들에 대한 답변 변화 확인
# 성능 유지/개선 여부 모니터링
```

### 3. 사용자 피드백 통합
```bash  
# 실제 사용자가 지적한 부정확한 답변 수집
# Ground Truth 데이터셋에 반영
# 정기적으로 테스트 케이스 업데이트
```

## 🎯 목표 설정

### 단기 목표 (1개월)
- 전체 정확도 75% 달성
- 안전 관련 질문 85% 정확도
- 인용 출처 80% 관련성

### 중기 목표 (3개월)  
- 전체 정확도 85% 달성
- 모든 카테고리 80% 이상
- 전문가 리뷰 4.0/5.0 이상

### 장기 목표 (6개월)
- 전체 정확도 90% 달성  
- 실시간 팩트체킹 기능
- 다국어 지원 정확도 측정

## 📋 체크리스트

### 테스트 실행 전
- [ ] OpenAI API 키 설정 확인
- [ ] 충분한 테스트 문서 다운로드 (각 카테고리별 최소 10개)
- [ ] Ground Truth 데이터 최신 업데이트
- [ ] 테스트 환경 초기화

### 테스트 실행 중  
- [ ] 모든 카테고리 테스트 완료
- [ ] 오류 로그 모니터링
- [ ] 중간 결과 검증

### 테스트 완료 후
- [ ] 결과 분석 및 문서화
- [ ] 성능 저하 구간 식별
- [ ] 개선 계획 수립
- [ ] 다음 테스트 일정 계획