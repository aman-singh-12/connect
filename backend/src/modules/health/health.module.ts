import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  controllers: [HealthController],
  providers: [HealthService, RedisHealthIndicator],
  exports: [HealthService],
})
export class HealthModule {}
