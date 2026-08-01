import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ICache, CacheOptions } from '@core/domain/ports/services';
import type { CacheConfig } from '@config/cache.config';

/**
 * Cache Entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * In-Memory Cache Service Implementation
 *
 * Simple in-memory cache for development and single-instance deployments.
 * For production multi-instance, replace with Redis implementation.
 *
 * Section 12.4: Caching Strategy - L1 In-Memory
 */
@Injectable()
export class CacheService implements ICache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;
  private readonly maxItems: number;

  constructor(private readonly configService: ConfigService) {
    const cacheConfig = this.configService.get<CacheConfig>('cache');
    this.keyPrefix = cacheConfig?.keyPrefix || 'app:';
    this.defaultTTL = cacheConfig?.ttl || 300; // 5 minutes
    this.maxItems = Math.max(1, cacheConfig?.max || 100);
  }

  private getFullKey(key: string, prefix?: string): string {
    return `${prefix || this.keyPrefix}${key}`;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (entry.expiresAt === null) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }

  private cleanupExpired(): void {
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  private getEntryByFullKey(fullKey: string): CacheEntry<unknown> | undefined {
    const entry = this.store.get(fullKey);

    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.store.delete(fullKey);
      return undefined;
    }

    return entry;
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.getEntryByFullKey(this.getFullKey(key));
    return Promise.resolve(entry ? (entry.value as T) : null);
  }

  set(key: string, value: unknown, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key, options?.prefix);
    const ttl = options?.ttl ?? this.defaultTTL;

    this.cleanupExpired();
    if (!this.store.has(fullKey) && this.store.size >= this.maxItems) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    const entry: CacheEntry<unknown> = {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
    };

    // Reinsert existing keys so the map also acts as a small LRU queue.
    this.store.delete(fullKey);
    this.store.set(fullKey, entry);

    return Promise.resolve();
  }

  delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    return Promise.resolve(this.store.delete(fullKey));
  }

  deleteByPattern(pattern: string): Promise<number> {
    const fullPattern = this.getFullKey(pattern);
    const regex = new RegExp(
      `^${fullPattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    );
    let count = 0;

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }

    return Promise.resolve(count);
  }

  exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const entry = this.store.get(fullKey);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(fullKey);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  getTTL(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);
    const entry = this.store.get(fullKey);

    if (!entry || this.isExpired(entry)) {
      return Promise.resolve(-2); // Key doesn't exist
    }

    if (entry.expiresAt === null) {
      return Promise.resolve(-1); // No TTL
    }

    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return Promise.resolve(Math.max(0, remaining));
  }

  setTTL(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const entry = this.store.get(fullKey);

    if (!entry || this.isExpired(entry)) {
      return Promise.resolve(false);
    }

    entry.expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    return Promise.resolve(true);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const fullKey = this.getFullKey(key, options?.prefix);
    const existing = this.getEntryByFullKey(fullKey);
    if (existing) {
      return existing.value as T;
    }

    const pending = this.inFlight.get(fullKey) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const operation = factory().then(async (value) => {
      await this.set(key, value, options);
      return value;
    });
    this.inFlight.set(fullKey, operation);

    try {
      return await operation;
    } finally {
      this.inFlight.delete(fullKey);
    }
  }

  increment(key: string, increment = 1): Promise<number> {
    const fullKey = this.getFullKey(key);
    const entry = this.store.get(fullKey) as CacheEntry<number> | undefined;

    let newValue: number;
    if (!entry || this.isExpired(entry)) {
      newValue = increment;
      this.store.set(fullKey, { value: newValue, expiresAt: null });
    } else {
      newValue = (entry.value || 0) + increment;
      entry.value = newValue;
    }

    return Promise.resolve(newValue);
  }

  async decrement(key: string, decrement = 1): Promise<number> {
    return this.increment(key, -decrement);
  }

  clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}
