// 향후 구현 가능한 고급 캐시 관리자

export class CacheManager {
  private cache: Map<string, any> = new Map();
  private accessTime: Map<string, number> = new Map();
  private sizeMap: Map<string, number> = new Map();
  
  constructor(
    private maxSize: number = 20,
    private maxMemoryMB: number = 500
  ) {}
  
  // LRU with size consideration
  set(key: string, value: any, sizeInBytes: number) {
    // Remove items if memory limit exceeded
    while (this.getTotalSize() + sizeInBytes > this.maxMemoryMB * 1024 * 1024) {
      this.removeLeastRecentlyUsed();
    }
    
    this.cache.set(key, value);
    this.accessTime.set(key, Date.now());
    this.sizeMap.set(key, sizeInBytes);
  }
  
  get(key: string) {
    if (this.cache.has(key)) {
      this.accessTime.set(key, Date.now());
      return this.cache.get(key);
    }
    return null;
  }
  
  private getTotalSize(): number {
    let total = 0;
    for (const size of this.sizeMap.values()) {
      total += size;
    }
    return total;
  }
  
  private removeLeastRecentlyUsed() {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessTime.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTime.delete(oldestKey);
      this.sizeMap.delete(oldestKey);
    }
  }
  
  getStats() {
    return {
      count: this.cache.size,
      totalSizeMB: Math.round(this.getTotalSize() / 1024 / 1024),
      maxSizeMB: this.maxMemoryMB,
      usage: Math.round((this.getTotalSize() / (this.maxMemoryMB * 1024 * 1024)) * 100)
    };
  }
}