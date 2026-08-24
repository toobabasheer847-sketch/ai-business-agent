import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ProposalModule } from '../../ai/agents/proposal/proposal.module.js';
import { TaskModule } from '../../ai/agents/task/task.module.js';
import { SchedulerService } from './scheduler.service';
import { AppLogger } from '../logging/logger.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), ProposalModule, TaskModule],
  providers: [SchedulerService],
  exports: [SchedulerService, ScheduleModule],
})
export class SchedulerModule implements OnModuleInit {
  constructor(private readonly logger: AppLogger) {}

  onModuleInit(): void {
    this.logger.log('SchedulerModule initialized with @nestjs/schedule', {
      requestId: undefined,
    }, {
      jobs: [
        'proposal-expiry-check (hourly)',
        'task-reminder-scan (every minute UTC)',
        'gmail-token-health-check (daily 3am UTC)',
      ],
    });
  }
}