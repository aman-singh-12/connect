import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infrastructure/redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await this.redis.ping();
      const isHealthy = result === 'PONG';
      return this.getStatus(key, isHealthy);
    } catch (error) {
      return this.getStatus(key, false, {
        message: (error as Error)?.message || 'Redis health check failed',
      });
    }
  }
}
