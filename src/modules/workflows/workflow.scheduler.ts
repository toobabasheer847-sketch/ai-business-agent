import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppLogger } from '../../infrastructure/logging/logger.service';
import { scheduledJobsEnabled } from '../../infrastructure/scheduler/scheduled-jobs';
import { WorkflowService } from './workflow.service';

@Injectable()
export class WorkflowScheduler {
  constructor(
    private readonly workflows: WorkflowService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'workflow-execution',
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
        { requestId: 'cron:workflow-execution:skipped' },
        { job: 'workflow-execution' },
      );
      return;
    }
    if (!this.workflows.schedulerAvailable()) {
      this.logger.error(
        'Workflow schedule skipped: REDIS_URL is not configured. Scheduled workflow execution is not running.',
        undefined,
        { requestId: 'cron:workflow-execution:unavailable' },
        { job: 'workflow-execution' },
      );
      return;
    }
    try {
      const result = await this.workflows.enqueueAll();
      this.logger.log(
        `Queued workflow execution for ${result.queued} tenant(s)`,
        { requestId: `cron:workflow-execution:${new Date().toISOString()}` },
        { job: 'workflow-execution', queued: result.queued },
      );
    } catch (error) {
      this.logger.error(
        'Workflow schedule failed',
        error instanceof Error ? error.stack : undefined,
        { requestId: 'cron:workflow-execution:failed' },
        { job: 'workflow-execution' },
      );
    }
  }
}
