
// Unified cache management with automatic cleanup and size limits
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  cleanupInterval?: number;
}

export class OptimizedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: options.cleanupInterval || 5 * 60 * 1000 // 5 minutes
    };

    this.startCleanupTimer();
  }

  set(key: string, data: T): void {
    const now = Date.now();
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictOldest(): void {
    if (this.cache.size === 0) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Singleton instances for different cache types
export const forecastCache = new OptimizedCache<any>({ maxSize: 500, ttl: 2 * 60 * 60 * 1000 }); // 2 hours
export const optimizationCache = new OptimizedCache<any>({ maxSize: 200, ttl: 24 * 60 * 60 * 1000 }); // 24 hours
