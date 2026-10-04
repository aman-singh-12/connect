import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { Request, Response } from 'express';

describe('HealthController & HealthService', () => {
  let controller: HealthController;
  let healthService: HealthService;
  let mockDataSource: Partial<DataSource>;
  let mockConfigService: Partial<ConfigService>;
  let mockRedisIndicator: Partial<RedisHealthIndicator>;

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ health_check: 1 }]),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(''),
    };

    mockRedisIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  const createMockRequest = (headers: Record<string, string> = {}) => {
    return {
      headers,
      query: {},
    } as unknown as Request;
  };

  describe('Liveness Probe (GET /health/live)', () => {
    it('should return 200 OK and process running status', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(result.process).toBe('running');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Readiness Probe (GET /health/ready)', () => {
    it('should return 200 OK when database is reachable', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ready(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          backend: 'up',
          database: 'connected',
          latencyMs: expect.any(Number),
        }),
      );
    });

    it('should return 503 Service Unavailable when database query fails', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused to Supabase PostgreSQL:5432'),
      );

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.ready(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          backend: 'up',
          database: 'unavailable',
          error: 'Database connection failed or project paused',
        }),
      );

      // Verify no sensitive connection strings or passwords leaked in response
      const jsonResponse = (res.json as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(jsonResponse)).not.toContain('5432');
    });

    it('should return 503 when query times out', async () => {
      let timeoutId: NodeJS.Timeout | undefined;
      (mockDataSource.query as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            timeoutId = setTimeout(resolve, 500);
          }),
      );

      // Call service with a short 20ms timeout for test speed
      const result = await healthService.checkDatabase(20);

      expect(result.status).toBe('unhealthy');
      expect(result.database).toBe('disconnected');
      expect(result.error).toBe('Database query timed out');

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  });

  describe('Comprehensive Health (GET /health)', () => {
    it('should return 200 OK when both DB and Redis are healthy', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.check(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          database: 'connected',
          redis: 'connected',
        }),
      );
    });
  });

  describe('Security & Token Authentication', () => {
    it('should allow unauthenticated access when HEALTH_CHECK_TOKEN is not configured', () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('');
      const req = createMockRequest();

      expect(() => healthService.validateToken(req)).not.toThrow();
    });

    it('should allow access when valid x-health-token header is provided', () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('secret-health-token-12345');
      const req = createMockRequest({ 'x-health-token': 'secret-health-token-12345' });

      expect(() => healthService.validateToken(req)).not.toThrow();
    });

    it('should reject access (401) when token is missing and HEALTH_CHECK_TOKEN is required', () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('secret-health-token-12345');
      const req = createMockRequest({});

      expect(() => healthService.validateToken(req)).toThrow(UnauthorizedException);
    });

    it('should reject access (401) when invalid token is provided', () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('secret-health-token-12345');
      const req = createMockRequest({ 'x-health-token': 'wrong-token' });

      expect(() => healthService.validateToken(req)).toThrow(UnauthorizedException);
    });
  });
});
