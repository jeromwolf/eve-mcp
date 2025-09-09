import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로그 레벨 정의
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 로그 포맷 정의
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// 일별 로그 파일 설정
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'daily', 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format,
  level: 'info'
});

// 에러 전용 로그 파일 설정
const errorFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'errors', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format
});

// 콘솔 출력 설정
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
      }
      return msg;
    })
  )
});

// Logger 인스턴스 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports: [
    dailyRotateFileTransport,
    errorFileTransport,
    consoleTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '..', 'logs', 'errors', 'exceptions.log') 
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '..', 'logs', 'errors', 'rejections.log') 
    })
  ]
});

// 성능 측정 헬퍼 함수
export function measurePerformance(operation: string) {
  const startTime = Date.now();
  
  return {
    end: (success: boolean = true, metadata?: any) => {
      const duration = Date.now() - startTime;
      logger.info(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        success,
        ...metadata
      });
      return duration;
    }
  };
}

// 에러 로깅 헬퍼 함수
export function logError(error: Error | any, context?: string) {
  const errorInfo = {
    message: error.message || String(error),
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  logger.error('Error occurred', errorInfo);
  return errorInfo;
}

// 요청 로깅 헬퍼 함수
export function logRequest(method: string, url: string, params?: any) {
  logger.info(`Request: ${method} ${url}`, { params });
}

// 응답 로깅 헬퍼 함수
export function logResponse(status: number, url: string, duration?: number) {
  const level = status >= 400 ? 'error' : 'info';
  logger.log(level, `Response: ${status} ${url}`, { duration: duration ? `${duration}ms` : undefined });
}

export default logger;