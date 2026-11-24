import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { scheduledJobsEnabled } from '../../infrastructure/scheduler/scheduled-jobs';
import { StrategicDecisionService } from './strategic-decision.service';

@Injectable()
export class StrategicDecisionScheduler {
  private readonly logger = new Logger(StrategicDecisionScheduler.name);

  constructor(
    private readonly decisions: StrategicDecisionService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'strategic-decision-refresh',
    timeZone: 'UTC',
  })
  async handle() {
    if (
      !scheduledJobsEnabled(
        this.configService.get<string>('SCHEDULED_JOBS_ENABLED'),
      )
    ) {
      this.logger.log(
        'Strategic refresh skipped because SCHEDULED_JOBS_ENABLED is off.',
      );
      return;
    }
    const result = await this.decisions.refreshScheduled();
    this.logger.log(
      `Strategic refresh finished for ${result.refreshed} tenants. Failed ${result.failed}. No recommendation was executed.`,
    );
  }
}
