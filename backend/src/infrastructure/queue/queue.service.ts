import { Injectable, Inject, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IQueueService, JobOptions } from './queue.interface';

export const ACTIVITY_QUEUE = 'ACTIVITY_QUEUE';
export const NOTIFICATIONS_QUEUE = 'NOTIFICATIONS_QUEUE';

@Injectable()
export class QueueService implements IQueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(ACTIVITY_QUEUE) private readonly activityQueue: Queue,
    @Inject(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async addJob<T>(name: string, data: T, opts?: JobOptions): Promise<void> {
    try {
      const queue = this.resolveQueue(name);

      const addPromise = queue.add(name, data, {
        delay: opts?.delay,
        attempts: opts?.attempts ?? 3,
        priority: opts?.priority,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Queue addJob timed out after 2000ms for ${name}`)), 2000),
      );

      await Promise.race([addPromise, timeoutPromise]);
      this.logger.debug(`Job enqueued: ${name}`);
    } catch (err) {
      this.logger.warn(`Failed to enqueue job "${name}": ${(err as Error).message}`);
    }
  }

  private resolveQueue(name: string): Queue {
    if (name.startsWith('notification')) return this.notificationsQueue;
    return this.activityQueue;
  }
}

