# Claude 개발 작업 가이드라인 (claude.md)

## 1. 작업 접근 방식

### 1.1 기본 원칙
- **천천히, 차분히 접근**: 서두르지 않고 단계별로 진행
- **깊이 있는 사고**: 각 단계에서 충분한 검토와 분석
- **체계적 진행**: 명확한 순서와 구조를 가지고 작업

### 1.2 작업 흐름
```
요구사항 분석 → 태스크 분할 → 개발 → 테스트 → 로깅 → 검토 → 배포
```

## 2. 태스크 관리

### 2.1 태스크 분할 원칙
- **세부 단위로 분할**: 각 태스크는 2-4시간 내에 완료 가능한 크기
- **의존성 고려**: 태스크 간 의존관계를 명확히 정의
- **우선순위 설정**: 중요도와 긴급도에 따른 순서 결정
- **담당자 지정**: 각 태스크별 명확한 책임자 배정

### 2.2 태스크 문서화 형식
```markdown
## Task #001: [태스크명]
- **목표**: 구체적인 달성 목표
- **범위**: 포함되는 작업과 제외되는 작업
- **선행조건**: 시작하기 전에 완료되어야 할 작업
- **예상시간**: 소요 시간 추정
- **완료조건**: 완료 판단 기준
- **위험요소**: 예상되는 문제점과 대응방안
```

## 3. 테스트 전략

### 3.1 테스트 단계
1. **단위 테스트**: 개별 함수/모듈 테스트
2. **통합 테스트**: 모듈 간 연동 테스트
3. **시스템 테스트**: 전체 시스템 검증
4. **사용자 테스트**: 실제 사용 시나리오 검증

### 3.2 테스트 완료 기준
- 모든 테스트 케이스 통과
- 코드 커버리지 80% 이상
- 성능 기준 충족
- 보안 검증 완료

## 4. 로깅 체계 (전면 개편)

### 4.1 스마트 로깅 전략

**로그 레벨 재정의 (2025)**
```
CRITICAL: 시스템 중단, 데이터 손실 위험
ERROR: 기능 실패, 사용자 영향 있음
WARN: 잠재적 문제, 모니터링 필요
INFO: 비즈니스 중요 이벤트
DEBUG: 개발/디버깅용 (프로덕션 제외)
TRACE: 상세 실행 흐름 (성능 영향 고려)
AUDIT: 규정 준수, 보안 이벤트
BUSINESS: 비즈니스 메트릭, 분석용
```

### 4.2 개인정보 보호 최우선 원칙

**⚠️ 중요: 로그에서 개인정보 완전 제거**

개인정보는 어떤 상황에서도 로그에 남겨서는 안 됩니다. 확인이 필요한 경우에도 대체 방법을 사용해야 합니다.

**절대 금지 항목**
```javascript
// ❌ 절대 금지: 개인정보 직접 로깅
logger.error('Login failed for user: john@example.com');
logger.info('Payment processed: Card 1234-5678-9012-3456');
logger.debug('User profile: ' + JSON.stringify(userProfile));
logger.warn('Password reset for phone: 010-1234-5678');

// ❌ 절대 금지: 민감 정보 포함된 객체 로깅
logger.info('API Request', { body: requestBody }); // 개인정보 포함 가능
logger.error('Database error', { query, params }); // 개인정보 파라미터 포함
```

**올바른 로깅 방법**
```javascript
// ✅ 권장: 개인정보 대신 익명 식별자 사용
logger.error('Login failed for userId: usr_123abc456');
logger.info('Payment processed for sessionId: sess_789def012');
logger.debug('Profile update for userHash: 4f9k2n7x8p');
logger.warn('Password reset requested for phoneHash: ph_5a8b9c2d');

// ✅ 권장: 민감 정보 제거 후 로깅
const sanitizedRequest = sanitizeLogData(requestBody);
logger.info('API Request', { body: sanitizedRequest });
```

### 4.3 자동 개인정보 제거 시스템

**로깅 미들웨어 구현**
```javascript
// 자동 개인정보 마스킹 시스템
const personalDataPatterns = {
  email: /[\w\.-]+@[\w\.-]+\.\w+/g,
  phone: /\d{2,3}-\d{3,4}-\d{4}/g,
  creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  koreanId: /\d{6}-\d{7}/g
};

const logSanitizer = {
  sanitize: (data) => {
    let sanitized = JSON.stringify(data);
    
    // 패턴 기반 자동 마스킹
    Object.entries(personalDataPatterns).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_MASKED]`);
    });
    
    // 특정 필드명 기반 마스킹
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    sensitiveFields.forEach(field => {
      const fieldPattern = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
      sanitized = sanitized.replace(fieldPattern, `"${field}": "[MASKED]"`);
    });
    
    return JSON.parse(sanitized);
  }
};

// 모든 로그에 자동 적용
const secureLogger = {
  info: (message, data) => logger.info(message, logSanitizer.sanitize(data)),
  error: (message, data) => logger.error(message, logSanitizer.sanitize(data)),
  warn: (message, data) => logger.warn(message, logSanitizer.sanitize(data))
};
```

### 4.4 구조화된 로깅 (개인정보 제거 버전)

**안전한 JSON 기반 구조화 로그**
```json
{
  "timestamp": "2025-09-09T10:30:00.000Z",
  "level": "ERROR",
  "service": "payment-service",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "spanId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "userId": "usr_7f9k2n8x", // 익명화된 사용자 ID
  "sessionId": "sess_456abc", // 세션 식별자 (개인정보 아님)
  "operation": "processPayment",
  "message": "Payment processing failed",
  "error": {
    "type": "PaymentGatewayException",
    "code": "PG_TIMEOUT",
    "stack": "..." // 개인정보 없는 스택 트레이스만
  },
  "context": {
    "amount": 99.99,
    "currency": "USD",
    "gatewayResponse": "timeout",
    "cardType": "VISA", // 카드 번호 대신 타입만
    "merchantId": "merchant_123" // 개인정보 아닌 비즈니스 식별자
  },
  "duration": 5000,
  "tags": ["payment", "gateway", "timeout"]
}
```

### 4.5 개인정보 대체 전략

**안전한 식별자 생성**
```javascript
// 개인정보 대신 사용할 안전한 식별자
const createSafeIdentifiers = {
  // 사용자 이메일 → 해시 기반 익명 ID
  userEmailToId: (email) => {
    const hash = crypto.createHash('sha256').update(email + SALT).digest('hex');
    return `usr_${hash.substring(0, 8)}`;
  },
  
  // 전화번호 → 해시 기반 익명 ID
  phoneToId: (phone) => {
    const hash = crypto.createHash('sha256').update(phone + SALT).digest('hex');
    return `ph_${hash.substring(0, 8)}`;
  },
  
  // 신용카드 → 마지막 4자리만 + 타입
  cardToSafeInfo: (cardNumber) => {
    return {
      lastFour: cardNumber.slice(-4),
      type: getCardType(cardNumber), // VISA, MASTER 등
      bin: cardNumber.substring(0, 6) // BIN (은행 식별 번호)
    };
  }
};
```

### 4.6 확인이 필요한 경우의 대안

**개인정보 없이 문제 추적하기**
```javascript
// ❌ 잘못된 방법: 개인정보로 직접 추적
logger.error(`Payment failed for user: ${user.email}`);

// ✅ 올바른 방법: 추적 가능한 익명 정보 활용
const correlationId = generateCorrelationId(); // 임시 추적 ID
const userHash = hashUserData(user.email); // 일관된 해시

logger.error('Payment failed', {
  correlationId,
  userHash,
  timestamp: Date.now(),
  errorCode: 'PAYMENT_GATEWAY_TIMEOUT'
});

// 별도 보안 저장소에 correlation ID와 실제 정보 매핑 저장 (암호화)
// 필요시에만 관리자가 별도 시스템에서 조회
```

### 4.7 개발환경에서의 예외 처리

**개발 단계별 로깅 정책**
```javascript
const logConfig = {
  development: {
    allowPersonalData: false, // 개발환경에서도 개인정보 금지
    logLevel: 'DEBUG',
    detailedErrors: true
  },
  staging: {
    allowPersonalData: false, // 스테이징에서도 개인정보 금지
    logLevel: 'INFO',
    detailedErrors: true
  },
  production: {
    allowPersonalData: false, // 프로덕션에서 절대 금지
    logLevel: 'WARN',
    detailedErrors: false
  }
};

// 환경과 관계없이 개인정보는 항상 마스킹
const logger = createLogger({
  ...logConfig[process.env.NODE_ENV],
  sanitizer: logSanitizer // 모든 환경에서 적용
});
```

### 4.8 컴플라이언스 및 감사

**로그 기반 컴플라이언스 확인**
```javascript
// 정기적인 로그 스캔으로 개인정보 누출 확인
const complianceChecker = {
  scanLogs: async () => {
    const violations = [];
    
    // 개인정보 패턴 검색
    for (const pattern of Object.values(personalDataPatterns)) {
      const matches = await searchLogsForPattern(pattern);
      if (matches.length > 0) {
        violations.push({ pattern, matches });
      }
    }
    
    return violations;
  },
  
  generateComplianceReport: () => {
    return {
      personalDataFound: false,
      lastScanDate: new Date(),
      violationCount: 0,
      status: 'COMPLIANT'
    };
  }
};
```

### 4.9 로그 보존 및 개인정보 정책

**자동 개인정보 제거 정책**
```javascript
const logRetentionPolicy = {
  // 혹시 남을 수 있는 개인정보도 자동 삭제
  personalDataPurge: {
    frequency: 'daily',
    retentionPeriod: '0 days', // 즉시 삭제
    scanPatterns: personalDataPatterns
  },
  
  // 일반 로그 보존 정책
  generalLogs: {
    realtime: '7 days',
    compressed: '90 days', 
    archived: '7 years' // 개인정보 제거된 상태로만
  }
};
```

### 4.10 지능형 로그 관리 (개인정보 보호 강화)

**AI 기반 로그 분석 (개인정보 제거 후)**
- **패턴 인식**: 개인정보 제거된 데이터로 이상 패턴 감지
- **예측 분석**: 익명화된 메트릭으로 장애 예측
- **자동 분류**: 민감 정보 없는 로그 이벤트 카테고리화
- **상관관계 분석**: 개인정보 없이도 여러 서비스 간 연관성 파악

## 5. 오류 처리

### 5.1 사전 오류 처리
- **입력 검증**: 모든 사용자 입력에 대한 유효성 검사
- **경계값 처리**: 최솟값, 최댓값, null 값 처리
- **네트워크 오류**: 연결 실패, 타임아웃 처리
- **리소스 부족**: 메모리, 디스크 공간 부족 대응

### 5.2 오류 처리 패턴
```javascript
try {
    // 위험한 작업
} catch (error) {
    logger.error('오류 발생', { error, context });
    // 복구 로직 또는 적절한 사용자 안내
} finally {
    // 정리 작업
}
```

## 6. 데이터 관리

### 6.1 더미 데이터 사용 원칙

**⚠️ 중요: 더미 데이터 의존성 방지**

더미 데이터는 개발 초기와 단위 테스트에서는 필요하지만, 실제 비즈니스 로직 검증을 회피하는 수단이 되어서는 안 됩니다.

**허용되는 더미 데이터 사용**
```javascript
// ✅ 단위 테스트 - 개별 함수 로직 검증
describe('calculateTax', () => {
  it('should calculate tax correctly', () => {
    const mockOrderData = {
      amount: 100,
      region: 'US',
      taxRate: 0.08
    };
    expect(calculateTax(mockOrderData)).toBe(8);
  });
});

// ✅ 개발 초기 - UI 컴포넌트 개발
const mockUserProfile = {
  name: 'John Doe',
  email: 'john@example.com',
  avatar: 'placeholder.jpg'
};
```

**금지되는 더미 데이터 사용**
```javascript
// ❌ 통합 테스트에서 실제 API 호출 회피
async function testUserRegistration() {
  // 실제 API 호출 대신 더미 응답 반환
  return { success: true, userId: 'dummy123' };
}

// ❌ 실제 데이터베이스 연동 없이 더미로 대체
function getUserOrders(userId) {
  // 실제 DB 쿼리 대신 하드코딩된 더미 데이터
  return [{ id: 1, product: 'dummy item' }];
}
```

### 6.2 데이터 검증 단계별 전략

**1단계: 단위 테스트 (더미 데이터 허용)**
- 개별 함수의 로직 검증
- 경계값, 예외 상황 테스트
- 빠른 피드백 루프 확보

**2단계: 통합 테스트 (실제 유사 데이터)**
- 샌드박스 환경의 실제 API 연동
- 실제 데이터베이스 스키마 사용
- 실제 외부 서비스와의 연동 검증

**3단계: 시스템 테스트 (실제 데이터)**
- 프로덕션과 동일한 데이터 구조
- 실제 사용자 시나리오 기반
- 성능과 보안까지 포함한 전체 검증

### 6.3 데이터 전환 체크리스트

**개발 단계별 데이터 검증**
```markdown
## Phase 1: 프로토타입 (더미 데이터 OK)
- [ ] 기본 UI/UX 동작 확인
- [ ] 핵심 비즈니스 로직 구현
- [ ] 기본 데이터 플로우 구현

## Phase 2: 알파 (혼합 데이터)
- [ ] 실제 API 스키마로 전환
- [ ] 데이터베이스 실제 스키마 적용
- [ ] 외부 서비스 샌드박스 연동

## Phase 3: 베타 (실제 데이터)
- [ ] 프로덕션 데이터 서브셋 사용
- [ ] 실제 사용자 플로우 검증
- [ ] 성능 및 확장성 테스트

## Phase 4: 프로덕션
- [ ] 100% 실제 데이터 처리
- [ ] 모든 더미 데이터 제거 확인
- [ ] 실제 비즈니스 임팩트 측정
```

### 6.4 더미 데이터 회피 방지책

**코드 리뷰 체크포인트**
- [ ] 하드코딩된 더미 값이 남아있지 않은가?
- [ ] 실제 API 호출이 Mock으로만 처리되지 않았나?
- [ ] 데이터베이스 연동이 인메모리로만 테스트되지 않았나?
- [ ] 외부 서비스 연동이 실제로 검증되었나?

**자동화된 검증**
```javascript
// 프로덕션 배포 전 자동 체크
const productionReadinessCheck = {
  noDummyData: () => {
    // 코드베이스에서 'dummy', 'mock', 'fake' 키워드 검색
    // 테스트 파일 외에서 발견 시 경고
  },
  realAPIIntegration: () => {
    // 실제 API 엔드포인트 연결 확인
    // 모든 외부 서비스 헬스체크
  },
  databaseConnectivity: () => {
    // 실제 데이터베이스 연결 및 쿼리 실행
    // 스키마 일치성 확인
  }
};
```

### 6.5 실제 데이터 사용 지침

**개인정보 보호와 실제 데이터 활용 균형**
- **마스킹된 실제 데이터**: 구조는 실제, 민감 정보는 마스킹
- **합성 데이터**: 실제 패턴을 학습한 AI 생성 데이터
- **샘플링**: 실제 데이터의 대표 샘플 사용

**데이터 품질 검증**
```javascript
// 실제 데이터 품질 체크
const dataQualityTests = {
  completeness: '필수 필드 누락률 < 1%',
  accuracy: '데이터 형식 준수율 > 99%',
  consistency: '참조 무결성 위반 = 0',
  timeliness: '데이터 최신성 < 24시간'
};
```

**더미에서 실제 데이터로의 전환 프로세스**
1. **의존성 식별**: 더미 데이터를 사용하는 모든 지점 파악
2. **단계적 전환**: 모듈별로 순차적 실제 데이터 적용
3. **검증 및 비교**: 더미 데이터와 실제 데이터 결과 비교
4. **성능 모니터링**: 실제 데이터 사용 시 성능 영향 측정
5. **완전 제거**: 모든 더미 데이터 의존성 제거 확인

## 7. 명확한 의사소통

### 7.1 불명확한 요구사항 대응
다음과 같은 경우 명확화 요청:
- 모호한 표현이 포함된 요구사항
- 여러 해석이 가능한 기능 명세
- 성능, 보안 등 비기능적 요구사항이 누락된 경우
- 우선순위가 불분명한 기능들

### 7.2 질문 템플릿
```markdown
## 명확화 요청

**질문 대상**: [요구사항 또는 기능명]

**현재 이해도**: 
- 제가 이해한 내용은 다음과 같습니다...

**불명확한 부분**:
1. [구체적인 질문 1]
2. [구체적인 질문 2]

**제안사항**:
- A 방식: [장단점]
- B 방식: [장단점]

**결정 필요사항**:
- [ ] 기능 범위
- [ ] 성능 요구사항
- [ ] 우선순위
```

## 8. 코드 품질

### 8.1 코딩 표준
- 일관된 네이밍 컨벤션
- 적절한 주석 작성
- 함수/메서드 크기 제한 (50줄 이내)
- 복잡도 관리 (순환 복잡도 10 이하)

### 8.2 코드 리뷰
- 기능 동작 검증
- 성능 영향 분석
- 보안 취약점 점검
- 유지보수성 평가

## 9. 문서화

### 9.1 필수 문서
- **README.md**: 프로젝트 개요 및 설치 방법
- **API 문서**: 모든 API 엔드포인트 상세 설명
- **아키텍처 문서**: 시스템 구조 및 설계 결정사항
- **배포 가이드**: 환경별 배포 절차

### 9.2 문서 업데이트
- 코드 변경 시 관련 문서 동시 업데이트
- 버전별 변경사항 기록
- 문서 리뷰 프로세스

## 10. 보안 고려사항

### 10.1 개발 단계 보안
- 입력값 검증 및 소독
- SQL 인젝션 방지
- XSS 공격 방지
- CSRF 토큰 사용

### 10.2 배포 단계 보안
- 환경변수로 민감 정보 관리
- HTTPS 강제 사용
- 접근 권한 최소화
- 정기적인 보안 업데이트

## 11. 성능 최적화

### 11.1 성능 모니터링
- 응답 시간 측정
- 메모리 사용량 추적
- 데이터베이스 쿼리 최적화
- 캐싱 전략 수립

### 11.2 성능 기준
- 웹 페이지 로딩: 3초 이내
- API 응답: 1초 이내
- 데이터베이스 쿼리: 100ms 이내

## 12. 배포 및 운영

### 12.1 배포 전 체크리스트
- [ ] 모든 테스트 통과
- [ ] 코드 리뷰 완료
- [ ] 문서 업데이트 완료
- [ ] 백업 계획 수립
- [ ] 롤백 계획 준비

### 12.2 모니터링
- 시스템 상태 실시간 모니터링
- 오류 발생 시 즉시 알림
- 정기적인 성능 리포트 생성

## 13. 지속적 개선

### 13.1 회고 프로세스
- **주간 회고**: 진행 상황, 성과, 개선점 공유 (30분 내외)
- **스프린트 회고**: KPT (Keep, Problem, Try) 방식 활용
- **프로젝트 완료 후 회고**: 전체 프로세스 평가 및 교훈 정리
- **분기별 프로세스 리뷰**: 워크플로우 전체 점검 및 개선

### 13.2 메트릭 기반 개선
- **개발 속도**: 리드 타임, 사이클 타임 측정
- **품질 지표**: 버그 발생률, 고객 만족도
- **팀 건강도**: 팀 만족도, 번아웃 지수
- **프로세스 효율성**: 배포 빈도, 평균 복구 시간

### 13.3 학습 및 실험
- **새로운 기술 검증**: 프로토타입으로 기술적 타당성 확인
- **프로세스 실험**: A/B 테스트 방식으로 프로세스 개선
- **외부 벤치마킹**: 업계 모범 사례 조사 및 적용
- **지식 공유 세션**: 실패 사례 포함한 솔직한 경험 공유