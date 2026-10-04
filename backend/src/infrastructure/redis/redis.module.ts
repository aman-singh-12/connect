import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { RedisShutdownService } from './redis-shutdown.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const BULLMQ_REDIS_CLIENT = 'BULLMQ_REDIS_CLIENT';

function buildRedisClient(config: ConfigService, forBullMQ: boolean): Redis {
  const logger = new Logger(forBullMQ ? 'BullMQRedis' : 'AppRedis');
  const redisUrl = config.get<string | undefined>('redis.url');

  const baseOptions: RedisOptions = {
    connectTimeout: 3000,
    commandTimeout: forBullMQ ? undefined : 1500,
    maxRetriesPerRequest: forBullMQ ? null : 1,
    enableOfflineQueue: false,
    lazyConnect: false,
    retryStrategy: (times: number) => Math.min(times * 1000, 30000),
  };

  const client = redisUrl
    ? new Redis(redisUrl, baseOptions)
    : new Redis({
        host: config.get<string>('redis.host', 'localhost'),
        port: config.get<number>('redis.port', 6379),
        password: config.get<string | undefined>('redis.password') || undefined,
        tls: config.get<boolean>('redis.tls', false) ? {} : undefined,
        ...baseOptions,
      });

  client.on('error', (err) => {
    logger.warn(`Redis [${forBullMQ ? 'BullMQ' : 'App'}] error: ${err.message}`);
  });

  client.on('connect', () => {
    logger.log(`Redis [${forBullMQ ? 'BullMQ' : 'App'}] connected`);
  });

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildRedisClient(config, false),
    },
    {
      provide: BULLMQ_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildRedisClient(config, true),
    },
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT, BULLMQ_REDIS_CLIENT],
})
export class RedisModule {}

