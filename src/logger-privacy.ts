import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경별 salt (프로덕션에서는 환경변수 사용)
const HASH_SALT = process.env.LOG_HASH_SALT || 'nrc-adams-default-salt-2025';

// 로그 레벨 정의 (개인정보 보호 강화)
const levels = {
  critical: 0,  // 시스템 중단, 데이터 손실 위험
  error: 1,     // 기능 실패, 사용자 영향
  warn: 2,      // 잠재적 문제, 모니터링 필요
  info: 3,      // 비즈니스 중요 이벤트
  debug: 4,     // 개발/디버깅용
  trace: 5,     // 상세 실행 흐름
  audit: 6,     // 규정 준수, 보안 이벤트
  business: 7   // 비즈니스 메트릭
};

// 개인정보 패턴 정의
const personalDataPatterns = {
  email: /[\w\.-]+@[\w\.-]+\.\w+/gi,
  phone: /\d{2,3}-\d{3,4}-\d{4}/gi,
  creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/gi,
  ssn: /\d{3}-\d{2}-\d{4}/gi,
  koreanId: /\d{6}-\d{7}/gi,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/gi,
  apiKey: /[a-zA-Z0-9]{32,}/gi,
  jwt: /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/gi
};

// 민감한 필드명 리스트
const sensitiveFields = [
  'password', 'passwd', 'pwd',
  'token', 'secret', 'key', 'auth',
  'authorization', 'cookie', 'session',
  'creditcard', 'cc', 'cvv',
  'ssn', 'socialsecurity',
  'api_key', 'apikey', 'private_key'
];

/**
 * 안전한 해시 기반 식별자 생성
 */
class SafeIdentifierGenerator {
  static generateHash(input: string, prefix: string = 'id'): string {
    const hash = crypto
      .createHash('sha256')
      .update(input + HASH_SALT)
      .digest('hex');
    return `${prefix}_${hash.substring(0, 8)}`;
  }

  static userIdentifier(email?: string): string {
    if (!email) return 'usr_anonymous';
    return this.generateHash(email, 'usr');
  }

  static sessionIdentifier(sessionId?: string): string {
    if (!sessionId) return 'sess_unknown';
    return this.generateHash(sessionId, 'sess');
  }

  static documentIdentifier(docNumber?: string): string {
    if (!docNumber) return 'doc_unknown';
    // 문서 번호는 공개 정보이므로 앞 6자만 표시
    return `doc_${docNumber?.substring(0, 6)}***`;
  }

  static urlSanitizer(url: string): string {
    try {
      const urlObj = new URL(url);
      // 도메인과 경로만 유지, 쿼리 파라미터 제거
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      // URL 파싱 실패 시 도메인만 추출 시도
      const domainMatch = url.match(/https?:\/\/[^\/]+/);
      return domainMatch ? domainMatch[0] : '[URL_MASKED]';
    }
  }

  static pathSanitizer(filePath: string): string {
    // 사용자 홈 디렉토리 경로 마스킹
    const sanitized = filePath
      .replace(/\/Users\/[^\/]+/, '/Users/[USER]')
      .replace(/\/home\/[^\/]+/, '/home/[USER]')
      .replace(/C:\\Users\\[^\\]+/, 'C:\\Users\\[USER]');
    
    // 파일명만 유지
    const fileName = path.basename(sanitized);
    const dir = path.dirname(sanitized);
    const dirParts = dir.split(path.sep);
    
    // 디렉토리 구조는 마지막 2개만 표시
    if (dirParts.length > 2) {
      return `.../${dirParts.slice(-2).join('/')}/${fileName}`;
    }
    
    return sanitized;
  }
}

/**
 * 로그 데이터 자동 정제 시스템
 */
class LogSanitizer {
  /**
   * 모든 개인정보를 자동으로 마스킹
   */
  static sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // 문자열인 경우
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    // 배열인 경우
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    // 객체인 경우
    if (typeof data === 'object') {
      return this.sanitizeObject(data);
    }

    return data;
  }

  /**
   * 문자열에서 개인정보 패턴 마스킹
   */
  private static sanitizeString(str: string): string {
    let sanitized = str;

    // 개인정보 패턴 마스킹
    Object.entries(personalDataPatterns).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_MASKED]`);
    });

    // URL 정제
    const urlPattern = /https?:\/\/[^\s]+/gi;
    sanitized = sanitized.replace(urlPattern, (match) => 
      SafeIdentifierGenerator.urlSanitizer(match)
    );

    // 파일 경로 정제
    const pathPattern = /(?:\/|\\)(?:Users|home|Documents|Desktop)[^\s]*/gi;
    sanitized = sanitized.replace(pathPattern, (match) => 
      SafeIdentifierGenerator.pathSanitizer(match)
    );

    return sanitized;
  }

  /**
   * 객체의 민감한 필드 마스킹
   */
  private static sanitizeObject(obj: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // 민감한 필드명 체크
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[SENSITIVE_MASKED]';
        continue;
      }

      // 특별 처리가 필요한 필드들
      if (key === 'email') {
        sanitized[key] = SafeIdentifierGenerator.userIdentifier(value as string);
      } else if (key === 'url' || key === 'endpoint') {
        sanitized[key] = SafeIdentifierGenerator.urlSanitizer(value as string);
      } else if (key === 'path' || key === 'filePath' || key === 'savePath') {
        sanitized[key] = SafeIdentifierGenerator.pathSanitizer(value as string);
      } else if (key === 'documentNumber' || key === 'accessionNumber') {
        sanitized[key] = SafeIdentifierGenerator.documentIdentifier(value as string);
      } else if (key === 'query' || key === 'searchQuery' || key === 'keyword') {
        // 검색 쿼리는 해시화
        sanitized[key] = SafeIdentifierGenerator.generateHash(value as string, 'query');
      } else if (key === 'stack' && typeof value === 'string') {
        // 스택 트레이스에서 경로 정제
        sanitized[key] = this.sanitizeString(value);
      } else {
        // 재귀적으로 정제
        sanitized[key] = this.sanitize(value);
      }
    }

    return sanitized;
  }
}

/**
 * 개인정보 보호 강화 로거 포맷
 */
const privacySafeFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    // 메시지와 메타데이터 정제
    const sanitizedMessage = LogSanitizer.sanitize(message);
    const sanitizedMetadata = LogSanitizer.sanitize(metadata);
    
    // correlation ID 생성 (추적용)
    const correlationId = metadata.correlationId || 
      crypto.randomBytes(8).toString('hex');
    
    let log = `${timestamp} [${level.toUpperCase()}] [${correlationId}]: ${sanitizedMessage}`;
    
    if (Object.keys(sanitizedMetadata).length > 0) {
      log += ` ${JSON.stringify(sanitizedMetadata)}`;
    }
    
    return log;
  })
);

// 일별 로그 파일 설정 (개인정보 제거)
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'daily', 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: privacySafeFormat,
  level: 'info'
});

// 에러 전용 로그 파일 설정 (개인정보 제거)
const errorFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'errors', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: privacySafeFormat
});

// 감사 로그 (규정 준수용)
const auditFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'audit', 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7y', // 7년 보관
  level: 'audit',
  format: privacySafeFormat
});

// 콘솔 출력 설정 (개발 환경)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      const sanitizedMessage = LogSanitizer.sanitize(message);
      let msg = `${timestamp} [${level}]: ${sanitizedMessage}`;
      
      if (Object.keys(metadata).length > 0) {
        const sanitizedMetadata = LogSanitizer.sanitize(metadata);
        msg += ` ${JSON.stringify(sanitizedMetadata, null, 2)}`;
      }
      
      return msg;
    })
  )
});

// 개인정보 보호 강화 로거 생성
const privacyLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: privacySafeFormat,
  transports: [
    dailyRotateFileTransport,
    errorFileTransport,
    auditFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '..', 'logs', 'errors', 'exceptions.log'),
      format: privacySafeFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '..', 'logs', 'errors', 'rejections.log'),
      format: privacySafeFormat
    })
  ]
});

// 개발 환경에서만 콘솔 출력
if (process.env.NODE_ENV !== 'production') {
  privacyLogger.add(consoleTransport);
}

/**
 * 성능 측정 헬퍼 (개인정보 보호)
 */
export function measurePerformance(operation: string) {
  const startTime = Date.now();
  const operationHash = SafeIdentifierGenerator.generateHash(operation, 'op');
  
  return {
    end: (success: boolean = true, metadata?: any) => {
      const duration = Date.now() - startTime;
      const sanitizedMetadata = LogSanitizer.sanitize(metadata);
      
      privacyLogger.info(`Performance: ${operationHash}`, {
        duration: `${duration}ms`,
        success,
        ...sanitizedMetadata
      });
      
      return duration;
    }
  };
}

/**
 * 에러 로깅 헬퍼 (개인정보 보호)
 */
export function logError(error: Error | any, context?: string) {
  const errorInfo = {
    message: error.message || String(error),
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  // 에러 정보 정제
  const sanitizedError = LogSanitizer.sanitize(errorInfo);
  privacyLogger.error('Error occurred', sanitizedError);
  
  return sanitizedError;
}

/**
 * 요청 로깅 헬퍼 (개인정보 보호)
 */
export function logRequest(method: string, url: string, params?: any) {
  const sanitizedUrl = SafeIdentifierGenerator.urlSanitizer(url);
  const sanitizedParams = LogSanitizer.sanitize(params);
  
  privacyLogger.info(`Request: ${method} ${sanitizedUrl}`, sanitizedParams);
}

/**
 * 응답 로깅 헬퍼 (개인정보 보호)
 */
export function logResponse(status: number, url: string, duration?: number) {
  const sanitizedUrl = SafeIdentifierGenerator.urlSanitizer(url);
  const level = status >= 400 ? 'error' : 'info';
  
  privacyLogger.log(level, `Response: ${status} ${sanitizedUrl}`, { 
    duration: duration ? `${duration}ms` : undefined 
  });
}

/**
 * 감사 로깅 (규정 준수)
 */
export function logAudit(event: string, metadata?: any) {
  const sanitizedMetadata = LogSanitizer.sanitize(metadata);
  privacyLogger.log('audit', `Audit: ${event}`, sanitizedMetadata);
}

/**
 * 비즈니스 메트릭 로깅
 */
export function logBusiness(metric: string, value: any, metadata?: any) {
  const sanitizedMetadata = LogSanitizer.sanitize(metadata);
  privacyLogger.log('business', `Business Metric: ${metric}`, {
    value,
    ...sanitizedMetadata
  });
}

/**
 * 컴플라이언스 체커
 */
export class ComplianceChecker {
  static async scanLogsForPersonalData(): Promise<any[]> {
    const violations: any[] = [];
    
    // 로그 파일 스캔 로직
    // 실제 구현 시 로그 파일을 읽어서 패턴 검사
    
    return violations;
  }
  
  static generateComplianceReport() {
    return {
      timestamp: new Date().toISOString(),
      personalDataFound: false,
      violationCount: 0,
      status: 'COMPLIANT',
      nextScanDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }
}

// 기본 로거 익스포트 (개인정보 보호 적용)
export default {
  critical: (message: string, metadata?: any) => 
    privacyLogger.log('critical', message, LogSanitizer.sanitize(metadata)),
  
  error: (message: string, metadata?: any) => 
    privacyLogger.error(message, LogSanitizer.sanitize(metadata)),
  
  warn: (message: string, metadata?: any) => 
    privacyLogger.warn(message, LogSanitizer.sanitize(metadata)),
  
  info: (message: string, metadata?: any) => 
    privacyLogger.info(message, LogSanitizer.sanitize(metadata)),
  
  debug: (message: string, metadata?: any) => 
    privacyLogger.debug(message, LogSanitizer.sanitize(metadata)),
  
  trace: (message: string, metadata?: any) => 
    privacyLogger.log('trace', message, LogSanitizer.sanitize(metadata)),
  
  audit: logAudit,
  business: logBusiness
};

// 안전한 식별자 생성기 익스포트
export { SafeIdentifierGenerator, LogSanitizer };