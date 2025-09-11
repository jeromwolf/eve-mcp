// Configuration management for NRC ADAMS MCP Server
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerConfig {
  cache: {
    maxSize: number;
    maxDocumentSizeMB: number;
  };
  adams: {
    apiBase: string;
    searchBase: string;
    timeout: number;
    retryAttempts: number;
  };
  download: {
    defaultTarget: number;
    maxConcurrent: number;
    timeoutMs: number;
  };
  storage: {
    pdfPath: string;
    logsPath: string;
  };
  rag: {
    chunkSize: number;
    chunkOverlap: number;
    maxTopK: number;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  public readonly config: ServerConfig;

  private constructor() {
    this.config = {
      cache: {
        maxSize: parseInt(process.env.MAX_CACHE_SIZE || '50'),
        maxDocumentSizeMB: parseInt(process.env.MAX_DOC_SIZE_MB || '10'),
      },
      adams: {
        apiBase: process.env.ADAMS_API_BASE || 'https://adams.nrc.gov/wba',
        searchBase: process.env.ADAMS_SEARCH_BASE || 'https://adams-search.nrc.gov',
        timeout: parseInt(process.env.ADAMS_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.ADAMS_RETRY_ATTEMPTS || '3'),
      },
      download: {
        defaultTarget: parseInt(process.env.DEFAULT_DOWNLOAD_TARGET || '10'),
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3'),
        timeoutMs: parseInt(process.env.DOWNLOAD_TIMEOUT || '120000'),
      },
      storage: {
        pdfPath: process.env.PDF_STORAGE_PATH || join(__dirname, '..', '..', 'downloaded_pdfs'),
        logsPath: process.env.LOGS_PATH || join(__dirname, '..', '..', 'logs'),
      },
      rag: {
        chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000'),
        chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200'),
        maxTopK: parseInt(process.env.RAG_MAX_TOP_K || '10'),
      },
    };
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): ServerConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<ServerConfig>): void {
    Object.assign(this.config, updates);
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.cache.maxSize <= 0) {
      errors.push('Cache max size must be positive');
    }

    if (this.config.adams.timeout <= 0) {
      errors.push('ADAMS timeout must be positive');
    }

    if (this.config.download.defaultTarget <= 0) {
      errors.push('Download target must be positive');
    }

    if (!this.config.storage.pdfPath) {
      errors.push('PDF storage path must be specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const configManager = ConfigManager.getInstance();
export const config = configManager.getConfig();