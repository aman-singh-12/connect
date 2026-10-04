import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ICacheService } from './cache.interface';
import { REDIS_CLIENT } from '../redis';

interface MemoryCacheEntry {
  value: any;
  expiry: number;
}

@Injectable()
export class RedisCacheService implements ICacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private withTimeout<T>(promise: Promise<T>, ms = 500): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Redis cache timeout after ${ms}ms`)), ms),
      ),
    ]);
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiry > now) {
      return memEntry.value as T;
    } else if (memEntry) {
      this.memoryCache.delete(key);
    }

    if (this.redis.status !== 'ready') {
      return null;
    }

    try {
      const raw = await this.withTimeout(this.redis.get(key), 500);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as T;
      this.memoryCache.set(key, { value: parsed, expiry: now + 30000 });
      return parsed;
    } catch (err) {
      this.logger.debug(`Redis get failed for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? 300;
    const now = Date.now();
    this.memoryCache.set(key, { value, expiry: now + ttl * 1000 });

    if (this.redis.status !== 'ready') {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.withTimeout(this.redis.set(key, serialized, 'EX', ttl), 500);
    } catch (err) {
      this.logger.debug(`Redis set failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.redis.status !== 'ready') {
      return;
    }

    try {
      await this.withTimeout(this.redis.del(key), 500);
    } catch (err) {
      this.logger.debug(`Redis del failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async reset(): Promise<void> {
    this.memoryCache.clear();

    if (this.redis.status !== 'ready') {
      return;
    }

    try {
      await this.withTimeout(this.redis.flushdb(), 1000);
    } catch (err) {
      this.logger.debug(`Redis reset failed: ${(err as Error).message}`);
    }
  }
}

