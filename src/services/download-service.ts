import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import mcpLogger from '../mcp-logger.js';
import { configManager } from '../server/config.js';
import { cacheManager } from './cache-manager.js';
import { extractTextFromPDF } from '../pdf-extractor.js';
import { createKeywordDownloadPath } from '../utils.js';

interface DownloadResult {
  success: boolean;
  filePath?: string;
  filename?: string;
  size?: number;
  metadata?: {
    title?: string;
    documentNumber?: string;
    docketNumber?: string;
    pages?: number;
  };
  content?: string;
  error?: string;
}

interface DownloadProgress {
  totalTargets: number;
  successCount: number;
  failureCount: number;
  attemptCount: number;
  results: DownloadResult[];
}

export class DownloadService {
  private readonly config;
  private downloadProgress: Map<string, DownloadProgress> = new Map();

  // High-success keywords for retry strategy
  private readonly HIGH_SUCCESS_KEYWORDS = [
    'license renewal application',
    'safety evaluation report',
    'inspection report',
    'environmental assessment',
    'technical specification',
    'reactor safety analysis',
    'nuclear facility license',
    'regulatory guide',
    'security plan',
    'quality assurance'
  ];

  constructor() {
    this.config = configManager.getConfig();
  }

  /**
   * Download documents with improved retry strategy
   * Continues until target count is reached or max attempts exceeded
   */
  async downloadDocumentsWithRetry(
    searchResults: any[],
    targetCount: number,
    sessionId: string,
    lastSearchQuery: string = 'general'
  ): Promise<DownloadProgress> {
    mcpLogger.info('Starting download with retry strategy', {
      sessionId,
      targetCount,
      availableResults: searchResults.length,
      query: lastSearchQuery
    });

    // Initialize progress tracking
    const progress: DownloadProgress = {
      totalTargets: targetCount,
      successCount: 0,
      failureCount: 0,
      attemptCount: 0,
      results: []
    };
    this.downloadProgress.set(sessionId, progress);

    let currentResults = [...searchResults];
    let keywordIndex = 0;

    while (progress.successCount < targetCount && progress.attemptCount < targetCount * 3) {
      // If we've exhausted current search results, get more with different keywords
      if (currentResults.length === 0) {
        mcpLogger.info('Exhausted current results, searching with new keyword', {
          sessionId,
          keywordIndex,
          successCount: progress.successCount
        });

        const newKeyword = this.HIGH_SUCCESS_KEYWORDS[keywordIndex % this.HIGH_SUCCESS_KEYWORDS.length];
        keywordIndex++;

        // This would need to be implemented with search service
        // For now, we'll break if no more results
        break;
      }

      const document = currentResults.shift()!;
      progress.attemptCount++;

      try {
        const result = await this.downloadSingleDocument(
          document,
          lastSearchQuery,
          sessionId
        );

        progress.results.push(result);

        if (result.success) {
          progress.successCount++;
          mcpLogger.info('Download success', {
            sessionId,
            successCount: progress.successCount,
            targetCount,
            filename: result.filename
          });
        } else {
          progress.failureCount++;
          mcpLogger.warn('Download failed', {
            sessionId,
            error: result.error,
            attemptCount: progress.attemptCount
          });
        }

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        progress.failureCount++;
        progress.results.push({
          success: false,
          error: error.message
        });
        
        mcpLogger.error('Download attempt failed', {
          sessionId,
          error: error.message,
          attemptCount: progress.attemptCount
        });
      }
    }

    mcpLogger.info('Download session completed', {
      sessionId,
      successCount: progress.successCount,
      targetCount,
      totalAttempts: progress.attemptCount,
      successRate: progress.successCount / progress.attemptCount
    });

    return progress;
  }

  /**
   * Download a single document
   */
  async downloadSingleDocument(
    document: any,
    keyword: string = 'general',
    sessionId: string = 'default'
  ): Promise<DownloadResult> {
    const documentNumber = document.accessionNumber || document.documentNumber;
    const title = document.title || 'Unknown Document';

    mcpLogger.debug('Starting single document download', {
      documentNumber,
      title,
      keyword,
      sessionId
    });

    try {
      // Check cache first
      const cacheKey = `download_${documentNumber}`;
      const cachedResult = cacheManager.get(cacheKey);
      if (cachedResult) {
        mcpLogger.info('Document found in cache', { documentNumber });
        return cachedResult;
      }

      // Create download path
      const filePath = await createKeywordDownloadPath(
        keyword,
        documentNumber,
        this.config.storage.pdfPath
      );

      // Check if file already exists
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > 1000) { // Minimum valid PDF size
          mcpLogger.info('Document already exists', {
            documentNumber,
            filePath,
            size: stats.size
          });

          // Skip text extraction for existing files to avoid timeout
          // Text extraction will be done by RAG engine when needed
          
          const result: DownloadResult = {
            success: true,
            filePath,
            filename: path.basename(filePath),
            size: stats.size,
            metadata: {
              title,
              documentNumber,
              docketNumber: document.docketNumber
            },
            content: undefined // Skip extraction for performance
          };

          cacheManager.set(cacheKey, result);
          return result;
        }
      } catch {
        // File doesn't exist, proceed with download
      }

      // Download from ADAMS
      const downloadUrl = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${documentNumber}`;
      
      mcpLogger.debug('Downloading from URL', {
        documentNumber,
        downloadUrl
      });

      const response: AxiosResponse = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer',
        timeout: this.config.download.timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Validate PDF content
      const buffer = Buffer.from(response.data);
      if (buffer.length < 1000 || !buffer.toString('utf8', 0, 4).includes('%PDF')) {
        throw new Error('Invalid PDF content received');
      }

      // Save to file
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);

      // Extract text content
      const content = await extractTextFromPDF(filePath);

      // Get PDF metadata
      const stats = await fs.stat(filePath);
      
      const result: DownloadResult = {
        success: true,
        filePath,
        filename: path.basename(filePath),
        size: stats.size,
        metadata: {
          title,
          documentNumber,
          docketNumber: document.docketNumber,
          pages: this.estimatePagesFromSize(stats.size)
        },
        content: content || undefined
      };

      // Cache the result
      cacheManager.set(cacheKey, result);

      mcpLogger.info('Document downloaded successfully', {
        documentNumber,
        filePath,
        size: stats.size,
        hasContent: !!content
      });

      return result;

    } catch (error: any) {
      const errorResult: DownloadResult = {
        success: false,
        error: error.message
      };

      mcpLogger.error('Document download failed', {
        documentNumber,
        error: error.message,
        sessionId
      });

      return errorResult;
    }
  }

  /**
   * Get download progress for a session
   */
  getDownloadProgress(sessionId: string): DownloadProgress | null {
    return this.downloadProgress.get(sessionId) || null;
  }

  /**
   * Clean up old progress tracking
   */
  cleanupProgress(maxAge: number = 60): void {
    const cutoff = Date.now() - (maxAge * 60 * 1000);
    let cleaned = 0;

    for (const [sessionId, progress] of this.downloadProgress.entries()) {
      // This would need timestamp tracking in progress object
      // For now, just limit total sessions
      if (this.downloadProgress.size > 10) {
        this.downloadProgress.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      mcpLogger.info('Cleaned up download progress', { cleaned });
    }
  }

  /**
   * Get download statistics
   */
  getStats(): {
    activeSessions: number;
    totalDownloads: number;
    successRate: number;
    averageSize: number;
  } {
    let totalDownloads = 0;
    let totalSuccesses = 0;
    let totalSize = 0;
    let totalFiles = 0;

    for (const progress of this.downloadProgress.values()) {
      totalDownloads += progress.attemptCount;
      totalSuccesses += progress.successCount;
      
      for (const result of progress.results) {
        if (result.success && result.size) {
          totalSize += result.size;
          totalFiles++;
        }
      }
    }

    return {
      activeSessions: this.downloadProgress.size,
      totalDownloads,
      successRate: totalDownloads > 0 ? totalSuccesses / totalDownloads : 0,
      averageSize: totalFiles > 0 ? totalSize / totalFiles : 0
    };
  }

  /**
   * Estimate page count from file size
   */
  private estimatePagesFromSize(size: number): number {
    // Rough estimation: 1 page ≈ 50-100KB for text PDFs
    const averagePageSize = 75 * 1024; // 75KB per page
    return Math.max(1, Math.round(size / averagePageSize));
  }

  /**
   * Validate document before processing
   */
  private isValidDocument(document: any): boolean {
    return !!(document.accessionNumber || document.documentNumber) && 
           document.title && 
           document.title !== 'Unknown' &&
           !document.title.includes('Not Available');
  }
}

// Singleton instance
export const downloadService = new DownloadService();