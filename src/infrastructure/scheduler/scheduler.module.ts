import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ProposalModule } from '../../ai/agents/proposal/proposal.module.js';
import { SchedulerService } from './scheduler.service';
import { AppLogger } from '../logging/logger.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), ProposalModule],
  providers: [SchedulerService],
  exports: [SchedulerService, ScheduleModule],
})
export class SchedulerModule implements OnModuleInit {
  constructor(private readonly logger: AppLogger) {}

  onModuleInit(): void {
    this.logger.log('SchedulerModule initialized with @nestjs/schedule', {
      requestId: undefined,
    }, {
      jobs: ['proposal-expiry-check (hourly)', 'gmail-token-health-check (daily 3am UTC)'],
    });
  }
}