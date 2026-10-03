import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /**
   * Comprehensive Health Check (Backend + Supabase DB + Redis)
   * GET /api/v1/health
   */
  @Get()
  @Public()
  async check(@Req() req: Request, @Res() res: Response) {
    this.healthService.validateToken(req);

    const dbResult = await this.healthService.checkDatabase(5000);
    const redisResult = await this.redisIndicator.isHealthy('redis');
    const isRedisUp = redisResult.redis?.status === 'up';

    const isHealthy = dbResult.status === 'healthy';
    const statusCode = isHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: dbResult.database,
      databaseLatencyMs: dbResult.latencyMs,
      redis: isRedisUp ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      ...(dbResult.error ? { error: dbResult.error } : {}),
    });
  }

  /**
   * Readiness Probe (Verifies PostgreSQL database is reachable)
   * GET /api/v1/health/ready
   */
  @Get('ready')
  @Public()
  async ready(@Req() req: Request, @Res() res: Response) {
    this.healthService.validateToken(req);

    const dbResult = await this.healthService.checkDatabase(5000);
    const statusCode =
      dbResult.status === 'healthy'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(dbResult);
  }

  /**
   * Liveness Probe (Verifies backend process is alive and responsive)
   * GET /api/v1/health/live
   */
  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  live() {
    return {
      status: 'ok',
      process: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dedicated Database Health Probe (Direct query against Supabase PostgreSQL)
   * GET /api/v1/health/db
   */
  @Get('db')
  @Public()
  async checkDb(@Req() req: Request, @Res() res: Response) {
    this.healthService.validateToken(req);

    const dbResult = await this.healthService.checkDatabase(5000);
    const statusCode =
      dbResult.status === 'healthy'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(dbResult);
  }
}
