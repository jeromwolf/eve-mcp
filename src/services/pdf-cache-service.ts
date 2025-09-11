import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import mcpLogger from '../mcp-logger.js';
import { extractTextFromPDF } from '../pdf-extractor.js';

interface PDFCacheEntry {
  documentNumber: string;
  filePath: string;
  textContent: string;
  extractedAt: number;
  fileSize: number;
  fileHash: string;
  metadata: {
    pages?: number;
    title?: string;
    extractionTime?: number;
  };
}

interface CacheStats {
  totalEntries: number;
  totalTextSize: number;
  cacheHitRate: number;
  averageExtractionTime: number;
}

export class PDFCacheService {
  private readonly cacheDir: string;
  private readonly indexFile: string;
  private cacheIndex: Map<string, PDFCacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    totalExtractions: 0,
    totalExtractionTime: 0
  };

  constructor(baseDir: string = 'pdf-text-cache') {
    this.cacheDir = path.resolve(baseDir);
    this.indexFile = path.join(this.cacheDir, 'cache-index.json');
    
    mcpLogger.info('PDFCacheService initialized', {
      cacheDir: this.cacheDir,
      indexFile: this.indexFile
    });
  }

  /**
   * Initialize cache system and load existing index
   */
  async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Load existing cache index
      await this.loadCacheIndex();
      
      mcpLogger.info('PDF cache system initialized', {
        cachedEntries: this.cacheIndex.size,
        cacheDir: this.cacheDir
      });
    } catch (error: any) {
      mcpLogger.error('Failed to initialize PDF cache', {
        error: error.message,
        cacheDir: this.cacheDir
      });
      throw error;
    }
  }

  /**
   * Get cached text or extract and cache PDF content
   */
  async getCachedText(pdfPath: string, documentNumber?: string): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      // Generate document number if not provided
      const docNum = documentNumber || path.basename(pdfPath, '.pdf');
      
      // Check if file exists
      const pdfStats = await fs.stat(pdfPath);
      const fileHash = await this.calculateFileHash(pdfPath);
      
      // Check cache first
      const existingCacheEntry = this.cacheIndex.get(docNum);
      if (existingCacheEntry && existingCacheEntry.fileHash === fileHash) {
        this.stats.hits++;
        
        mcpLogger.debug('PDF text cache hit', {
          documentNumber: docNum,
          textSize: existingCacheEntry.textContent.length,
          cachedAt: new Date(existingCacheEntry.extractedAt).toISOString()
        });
        
        return existingCacheEntry.textContent;
      }
      
      // Cache miss - extract text
      this.stats.misses++;
      mcpLogger.info('PDF text cache miss, extracting', {
        documentNumber: docNum,
        fileSize: pdfStats.size,
        filePath: pdfPath
      });
      
      const extractStartTime = Date.now();
      const textContent = await extractTextFromPDF(pdfPath);
      const extractionTime = Date.now() - extractStartTime;
      
      if (!textContent) {
        mcpLogger.warn('PDF text extraction failed', { documentNumber: docNum });
        return null;
      }
      
      // Create new cache entry
      const newCacheEntry: PDFCacheEntry = {
        documentNumber: docNum,
        filePath: pdfPath,
        textContent,
        extractedAt: Date.now(),
        fileSize: pdfStats.size,
        fileHash,
        metadata: {
          pages: this.estimatePages(textContent),
          title: `Document ${docNum}`,
          extractionTime
        }
      };
      
      // Save to cache
      await this.saveCacheEntry(newCacheEntry);
      
      // Update stats
      this.stats.totalExtractions++;
      this.stats.totalExtractionTime += extractionTime;
      
      mcpLogger.info('PDF text cached successfully', {
        documentNumber: docNum,
        textSize: textContent.length,
        extractionTime,
        pages: newCacheEntry.metadata.pages
      });
      
      return textContent;
      
    } catch (error: any) {
      mcpLogger.error('PDF cache operation failed', {
        error: error.message,
        pdfPath,
        documentNumber
      });
      return null;
    }
  }

  /**
   * Pre-cache all PDFs in a directory
   */
  async batchCachePDFs(pdfDirectory: string): Promise<void> {
    mcpLogger.info('Starting batch PDF caching', { directory: pdfDirectory });
    
    const startTime = Date.now();
    let processed = 0;
    let skipped = 0;
    
    try {
      // Find all PDF files recursively
      const pdfFiles = await this.findAllPDFs(pdfDirectory);
      
      mcpLogger.info('Found PDFs for batch processing', {
        totalFiles: pdfFiles.length,
        directory: pdfDirectory
      });
      
      // Process each PDF with concurrency control
      const concurrency = 3; // Process 3 PDFs at a time
      const batches = this.chunkArray(pdfFiles, concurrency);
      
      for (const batch of batches) {
        await Promise.all(
          batch.map(async (pdfPath) => {
            try {
              const docNum = path.basename(pdfPath, '.pdf');
              const cachedText = await this.getCachedText(pdfPath, docNum);
              
              if (cachedText) {
                processed++;
                mcpLogger.debug('Batch cached PDF', {
                  documentNumber: docNum,
                  textSize: cachedText.length
                });
              } else {
                skipped++;
                mcpLogger.warn('Batch caching failed for PDF', { pdfPath });
              }
            } catch (error: any) {
              skipped++;
              mcpLogger.error('Batch processing error', {
                pdfPath,
                error: error.message
              });
            }
          })
        );
        
        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const totalTime = Date.now() - startTime;
      
      mcpLogger.info('Batch PDF caching completed', {
        processed,
        skipped,
        totalTime,
        averageTime: Math.round(totalTime / (processed + skipped))
      });
      
    } catch (error: any) {
      mcpLogger.error('Batch PDF caching failed', {
        error: error.message,
        directory: pdfDirectory
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const cacheHitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const avgExtractionTime = this.stats.totalExtractions > 0 
      ? this.stats.totalExtractionTime / this.stats.totalExtractions 
      : 0;
    
    const totalTextSize = Array.from(this.cacheIndex.values())
      .reduce((sum, entry) => sum + entry.textContent.length, 0);
    
    return {
      totalEntries: this.cacheIndex.size,
      totalTextSize,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      averageExtractionTime: Math.round(avgExtractionTime)
    };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      // Remove all cache files
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      
      // Clear in-memory index
      this.cacheIndex.clear();
      
      // Reset stats
      this.stats = { hits: 0, misses: 0, totalExtractions: 0, totalExtractionTime: 0 };
      
      mcpLogger.info('PDF cache cleared');
    } catch (error: any) {
      mcpLogger.error('Failed to clear PDF cache', { error: error.message });
    }
  }

  // Private helper methods

  private async loadCacheIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexFile, 'utf8');
      const cacheEntries: PDFCacheEntry[] = JSON.parse(indexData);
      
      // Rebuild index map
      this.cacheIndex.clear();
      for (const entry of cacheEntries) {
        this.cacheIndex.set(entry.documentNumber, entry);
      }
      
      mcpLogger.debug('Cache index loaded', { entries: cacheEntries.length });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        mcpLogger.warn('Failed to load cache index', { error: error.message });
      }
      // Start with empty cache if index doesn't exist
    }
  }

  private async saveCacheIndex(): Promise<void> {
    try {
      const cacheEntries = Array.from(this.cacheIndex.values());
      await fs.writeFile(this.indexFile, JSON.stringify(cacheEntries, null, 2));
    } catch (error: any) {
      mcpLogger.error('Failed to save cache index', { error: error.message });
    }
  }

  private async saveCacheEntry(entry: PDFCacheEntry): Promise<void> {
    // Add to in-memory index
    this.cacheIndex.set(entry.documentNumber, entry);
    
    // Save text to individual cache file
    const cacheFile = path.join(this.cacheDir, `${entry.documentNumber}.txt`);
    await fs.writeFile(cacheFile, entry.textContent);
    
    // Update index file
    await this.saveCacheIndex();
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  private estimatePages(textContent: string): number {
    // Rough estimate: ~250 words per page, ~5 chars per word
    const wordsPerPage = 250;
    const charsPerWord = 5;
    const estimatedWords = textContent.length / charsPerWord;
    return Math.max(1, Math.ceil(estimatedWords / wordsPerPage));
  }

  private async findAllPDFs(directory: string): Promise<string[]> {
    const pdfFiles: string[] = [];
    
    const processDirectory = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(fullPath);
        }
      }
    };
    
    await processDirectory(directory);
    return pdfFiles;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Singleton instance
export const pdfCacheService = new PDFCacheService();