import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AppLogger } from '../logging/logger.service';

export const QUEUE_NAMES = {
  PROPOSAL: 'proposal-queue',
  RAG_EMBEDDING: 'rag-embedding-queue',
  AUDIT: 'audit-queue',
  TASK_REMINDER: 'task-reminder-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') ||
          configService.get<string>('redis.url');
        const connection = redisUrl ? { url: redisUrl } : {};
        return {
          connection,
          defaultJobOptions: {
            attempts: 3,
            removeOnComplete: 100,
            removeOnFail: 500,
            backoff: {
              type: 'exponential' as const,
              delay: 1000,
            },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.PROPOSAL },
      { name: QUEUE_NAMES.RAG_EMBEDDING },
      { name: QUEUE_NAMES.AUDIT },
      { name: QUEUE_NAMES.TASK_REMINDER },
    ),
  ],
  providers: [],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('redis.url');
    if (!redisUrl) {
      this.logger.warn(
        'QueueModule loaded but REDIS_URL is not configured. BullMQ queue tokens are registered for future use but will fail to dispatch jobs until Redis is configured.',
      );
    } else {
      const masked = redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
      this.logger.log('QueueModule initialized with BullMQ Redis connection', {
        requestId: undefined,
      }, { maskedRedisUrl: masked, queues: Object.values(QUEUE_NAMES) });
    }
  }
}