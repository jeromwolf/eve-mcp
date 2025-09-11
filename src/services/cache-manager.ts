import mcpLogger from '../mcp-logger.js';
import { configManager } from '../server/config.js';

interface CacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  totalEntries: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  mostAccessed: string | null;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private readonly maxSize: number;
  private readonly maxDocumentSizeMB: number;

  constructor() {
    const config = configManager.getConfig();
    this.maxSize = config.cache.maxSize;
    this.maxDocumentSizeMB = config.cache.maxDocumentSizeMB;
    
    mcpLogger.info('CacheManager initialized', {
      maxSize: this.maxSize,
      maxDocumentSizeMB: this.maxDocumentSizeMB
    });
  }

  /**
   * Add item to cache with LRU eviction
   */
  set(key: string, data: any): void {
    // Check document size limit
    const dataSizeMB = this.getDataSizeMB(data);
    if (dataSizeMB > this.maxDocumentSizeMB) {
      mcpLogger.warn('Document too large for cache', {
        key,
        sizeMB: dataSizeMB,
        maxSizeMB: this.maxDocumentSizeMB
      });
      return;
    }

    const now = Date.now();
    
    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.data = data;
      entry.timestamp = now;
      entry.lastAccess = now;
      entry.accessCount++;
      mcpLogger.debug('Cache entry updated', { key, accessCount: entry.accessCount });
      return;
    }

    // If at capacity, remove LRU entry
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccess: now
    });

    mcpLogger.debug('Cache entry added', {
      key,
      cacheSize: this.cache.size,
      dataSizeMB: dataSizeMB
    });
  }

  /**
   * Get item from cache
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (entry) {
      // Update access info
      entry.lastAccess = Date.now();
      entry.accessCount++;
      this.hitCount++;
      
      mcpLogger.debug('Cache hit', {
        key,
        accessCount: entry.accessCount
      });
      
      return entry.data;
    }

    this.missCount++;
    mcpLogger.debug('Cache miss', { key });
    return null;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove item from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      mcpLogger.debug('Cache entry deleted', { key });
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    mcpLogger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    
    let oldestTimestamp = Date.now();
    let mostAccessedKey: string | null = null;
    let maxAccessCount = 0;
    let totalMemory = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.accessCount > maxAccessCount) {
        maxAccessCount = entry.accessCount;
        mostAccessedKey = key;
      }
      totalMemory += this.getDataSizeMB(entry.data);
    }

    return {
      totalEntries: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: Math.round(totalMemory * 100) / 100,
      oldestEntry: oldestTimestamp,
      mostAccessed: mostAccessedKey
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      mcpLogger.debug('LRU eviction', {
        evictedKey: lruKey,
        lastAccess: new Date(lruTime).toISOString()
      });
    }
  }

  /**
   * Calculate data size in MB (rough estimation)
   */
  private getDataSizeMB(data: any): number {
    const jsonString = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonString).length;
    return bytes / (1024 * 1024);
  }

  /**
   * Get entries older than specified age (in minutes)
   */
  getEntriesOlderThan(ageMinutes: number): string[] {
    const cutoffTime = Date.now() - (ageMinutes * 60 * 1000);
    const oldKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        oldKeys.push(key);
      }
    }

    return oldKeys;
  }

  /**
   * Remove entries older than specified age
   */
  cleanupOldEntries(ageMinutes: number): number {
    const oldKeys = this.getEntriesOlderThan(ageMinutes);
    let removedCount = 0;

    for (const key of oldKeys) {
      if (this.cache.delete(key)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      mcpLogger.info('Cache cleanup completed', {
        removedCount,
        ageMinutes,
        remainingEntries: this.cache.size
      });
    }

    return removedCount;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();