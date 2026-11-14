import { Module } from '@nestjs/common';

import { TeamAgentModule } from '../../ai/agents/team/team-agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [AuthModule, DashboardModule, TeamAgentModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
