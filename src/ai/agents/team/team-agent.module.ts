import { Module } from '@nestjs/common';

import { TeamAgent } from './team-agent.js';
import { TeamAnalyticsRepository } from './team-analytics.repository.js';
import { TeamAnalyticsService } from './team-analytics.service.js';

@Module({
  providers: [TeamAnalyticsRepository, TeamAnalyticsService, TeamAgent],
  exports: [TeamAgent, TeamAnalyticsService],
})
export class TeamAgentModule {}
