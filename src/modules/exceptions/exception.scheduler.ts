import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppLogger } from '../../infrastructure/logging/logger.service';
import { scheduledJobsEnabled } from '../../infrastructure/scheduler/scheduled-jobs';
import { ExceptionService } from './exception.service';

@Injectable()
export class ExceptionScheduler {
  constructor(
    private readonly exceptions: ExceptionService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'exception-detection',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    if (
      !scheduledJobsEnabled(
        this.configService.get<string>('SCHEDULED_JOBS_ENABLED'),
      )
    ) {
      this.logger.log(
        'Scheduled job skipped because SCHEDULED_JOBS_ENABLED is off',
        { requestId: 'cron:exception-detection:skipped' },
        { job: 'exception-detection' },
      );
      return;
    }
    if (!this.exceptions.schedulerAvailable()) {
      this.logger.error(
        'Exception detection schedule skipped: REDIS_URL is not configured. Scheduled detection is not running.',
        undefined,
        { requestId: 'cron:exception-detection:unavailable' },
        { job: 'exception-detection' },
      );
      return;
    }
    try {
      const result = await this.exceptions.enqueueAll();
      this.logger.log(
        `Queued exception detection for ${result.queued} tenant(s)`,
        { requestId: `cron:exception-detection:${new Date().toISOString()}` },
        { job: 'exception-detection', queued: result.queued },
      );
    } catch (error) {
      this.logger.error(
        'Exception detection schedule failed',
        error instanceof Error ? error.stack : undefined,
        { requestId: 'cron:exception-detection:failed' },
        { job: 'exception-detection' },
      );
    }
  }
}
