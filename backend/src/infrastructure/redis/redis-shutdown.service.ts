import { Injectable, Inject, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT, BULLMQ_REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisShutdownService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() @Inject(BULLMQ_REDIS_CLIENT) private readonly bullmqRedis?: Redis,
  ) {}

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connect') {
        await this.redis.quit().catch(() => this.redis.disconnect());
      } else {
        this.redis.disconnect();
      }
    } catch {
      this.redis.disconnect();
    }

    const bullClient = this.bullmqRedis;
    if (bullClient) {
      try {
        if (bullClient.status === 'ready' || bullClient.status === 'connect') {
          await bullClient.quit().catch(() => bullClient.disconnect());
        } else {
          bullClient.disconnect();
        }
      } catch {
        bullClient.disconnect();
      }
    }

    this.logger.log('Redis connection closed');
  }
}

