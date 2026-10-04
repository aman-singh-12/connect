import { Injectable, Inject, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infrastructure/redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (this.redis.status !== 'ready') {
      return this.getStatus(key, false, {
        message: `Redis is not connected (status: ${this.redis.status})`,
      });
    }

    try {
      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out after 1000ms')), 1000),
      );

      const result = await Promise.race([pingPromise, timeoutPromise]);
      const isHealthy = result === 'PONG';
      return this.getStatus(key, isHealthy);
    } catch (error) {
      return this.getStatus(key, false, {
        message: (error as Error)?.message || 'Redis health check failed',
      });
    }
  }
}

