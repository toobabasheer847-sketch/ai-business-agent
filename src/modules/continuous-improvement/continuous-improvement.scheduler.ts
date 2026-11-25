import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { scheduledJobsEnabled } from '../../infrastructure/scheduler/scheduled-jobs';
import { ContinuousImprovementService } from './continuous-improvement.service';

@Injectable()
export class ContinuousImprovementScheduler {
  private readonly logger = new Logger(ContinuousImprovementScheduler.name);

  constructor(
    private readonly improvement: ContinuousImprovementService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'continuous-improvement-monitor',
    timeZone: 'UTC',
  })
  async handle() {
    if (!scheduledJobsEnabled(this.configService.get<string>('SCHEDULED_JOBS_ENABLED'))) {
      this.logger.log('Continuous improvement monitoring skipped because SCHEDULED_JOBS_ENABLED is off.');
      return;
    }
    if (!this.improvement.schedulerAvailable()) {
      this.logger.error('Continuous improvement schedule skipped: REDIS_URL is not configured. Use manual refresh.');
      return;
    }
    try {
      const result = await this.improvement.enqueueAll();
      this.logger.log(
        `Queued continuous improvement monitoring for ${result.queued} tenants. Failed ${result.failed}. No action was executed.`,
      );
    } catch (error) {
      this.logger.error(
        'Continuous improvement schedule failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
