import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

interface MemoryRateEntry {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

@Injectable()
export class ThrottlerRedisStorage {
  private readonly logger = new Logger(ThrottlerRedisStorage.name);
  private readonly memoryStorage = new Map<string, MemoryRateEntry>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private withTimeout<T>(promise: Promise<T>, ms = 500): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Throttler timeout after ${ms}ms`)), ms),
      ),
    ]);
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ) {
    const now = Date.now();
    let entry = this.memoryStorage.get(key);

    if (!entry || entry.expiresAt <= now) {
      entry = {
        hits: 1,
        expiresAt: now + ttl,
        blockedUntil: 0,
      };
      this.memoryStorage.set(key, entry);
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    entry.hits += 1;
    const isBlocked =
      (entry.blockedUntil > now) || (blockDuration > 0 && entry.hits > limit);
    if (!entry.blockedUntil && blockDuration > 0 && entry.hits > limit) {
      entry.blockedUntil = now + blockDuration;
    }

    return {
      totalHits: entry.hits,
      timeToExpire: Math.max(0, entry.expiresAt - now),
      isBlocked,
      timeToBlockExpire: Math.max(0, entry.blockedUntil - now),
    };
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    if (this.redis.status !== 'ready') {
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }

    try {
      const redisKey = `rate:${key}`;
      const totalHits = await this.withTimeout(this.redis.incr(redisKey), 500);

      if (totalHits === 1) {
        await this.withTimeout(this.redis.expire(redisKey, Math.ceil(ttl / 1000)), 500).catch(() => {});
      }

      const ttlRemaining = await this.withTimeout(this.redis.ttl(redisKey), 500).catch(() => Math.ceil(ttl / 1000));

      const blockKey = `rate:block:${key}`;
      let isBlocked = false;
      let timeToBlockExpire = 0;

      if (blockDuration > 0) {
        const blockExists = await this.withTimeout(this.redis.exists(blockKey), 500).catch(() => 0);
        isBlocked = blockExists === 1;

        if (isBlocked) {
          const blockTtl = await this.withTimeout(this.redis.ttl(blockKey), 500).catch(() => 0);
          timeToBlockExpire = blockTtl * 1000;
        } else if (totalHits > limit) {
          await this.withTimeout(
            this.redis.set(
              blockKey,
              '1',
              'EX',
              Math.ceil(blockDuration / 1000),
            ),
            500,
          ).catch(() => {});
          isBlocked = true;
          timeToBlockExpire = blockDuration;
        }
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, ttlRemaining * 1000),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err) {
      this.logger.debug(`Redis rate limiting failed, falling back to memory: ${(err as Error).message}`);
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }
  }
}

