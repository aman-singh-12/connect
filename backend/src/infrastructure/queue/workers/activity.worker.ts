import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { BULLMQ_REDIS_CLIENT } from '../../redis';
import { ActivityService } from '../../../modules/activity/services/activity.service';
import { DomainEvent } from '../../../shared/interfaces';

@Injectable()
export class ActivityWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityWorker.name);
  private worker: Worker;

  constructor(
    @Inject(BULLMQ_REDIS_CLIENT) private readonly redis: Redis,
    private readonly activityService: ActivityService,
  ) {}

  onModuleInit() {
    try {
      this.worker = new Worker(
        'activity',
        async (job: Job<DomainEvent>) => {
          const start = Date.now();
          await this.activityService.log(job.data);
          const duration = Date.now() - start;
          this.logger.debug(
            `Job ${job.id} processed: ${job.data.type} (${duration}ms)`,
          );
        },
        {
          connection: this.redis,
          concurrency: 5,
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.error(
          `Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`,
        );
      });

      this.worker.on('error', (error) => {
        this.logger.warn(`Activity worker connection error: ${error.message}`);
      });

      this.logger.log('Activity worker started (concurrency: 5)');
    } catch (err) {
      this.logger.warn(`Failed to initialize Activity worker: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      this.logger.log('Shutting down activity worker...');
      await this.worker.close().catch(() => {});
      this.logger.log('Activity worker stopped');
    }
  }
}

