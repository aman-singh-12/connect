import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface DatabaseHealthResult {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  latencyMs?: number;
  timestamp: string;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validate health check token if HEALTH_CHECK_TOKEN is set in environment.
   * Uses constant-time string comparison to prevent timing attacks.
   */
  validateToken(req: Request): void {
    const expectedToken = this.config.get<string>('HEALTH_CHECK_TOKEN') || process.env.HEALTH_CHECK_TOKEN;

    // If no token is configured, allow public access
    if (!expectedToken || expectedToken.trim() === '') {
      return;
    }

    let providedToken = (req.headers['x-health-token'] as string) || '';

    if (!providedToken && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        providedToken = authHeader.substring(7).trim();
      }
    }

    if (!providedToken && typeof req.query?.token === 'string') {
      providedToken = req.query.token;
    }

    if (!providedToken) {
      throw new UnauthorizedException('Missing required health check token');
    }

    const expectedBuffer = Buffer.from(expectedToken.trim());
    const providedBuffer = Buffer.from(providedToken.trim());

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid health check token');
    }
  }

  /**
   * Execute a lightweight read-only query (SELECT 1;) against PostgreSQL
   * with timeout handling and latency measurement.
   */
  async checkDatabase(timeoutMs = 5000): Promise<DatabaseHealthResult> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection pool is not initialized');
      }

      // Enforce timeout using Promise.race with timer cleanup
      let timer: NodeJS.Timeout | undefined;
      const queryPromise = this.dataSource.query('SELECT 1 AS health_check;');
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Database health check query timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      try {
        await Promise.race([queryPromise, timeoutPromise]);
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }

      const latencyMs = Date.now() - startTime;

      return {
        status: 'healthy',
        database: 'connected',
        latencyMs,
        timestamp,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const rawMessage = (error as Error)?.message || 'Unknown database error';

      // Log error server-side without exposing credentials
      this.logger.warn(`Database health check failed: ${rawMessage}`);

      return {
        status: 'unhealthy',
        database: 'disconnected',
        latencyMs,
        timestamp,
        error: rawMessage.includes('timed out')
          ? 'Database query timed out'
          : 'Database connection failed or project paused',
      };
    }
  }
}
