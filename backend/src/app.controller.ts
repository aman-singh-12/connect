import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  getRoot() {
    return {
      name: 'Connect API',
      status: 'online',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/v1/health',
        ready: '/api/v1/health/ready',
        live: '/api/v1/health/live',
      },
    };
  }
}
