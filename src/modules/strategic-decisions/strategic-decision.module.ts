import { Module } from '@nestjs/common';

import { TaskModule } from '../../ai/agents/task/task.module';
import { BusinessIntelligenceModule } from '../business-intelligence/business-intelligence.module';
import { StrategicDecisionController } from './strategic-decision.controller';
import { StrategicDecisionScheduler } from './strategic-decision.scheduler';
import { StrategicDecisionService } from './strategic-decision.service';

@Module({
  imports: [BusinessIntelligenceModule, TaskModule],
  controllers: [StrategicDecisionController],
  providers: [StrategicDecisionService, StrategicDecisionScheduler],
  exports: [StrategicDecisionService],
})
export class StrategicDecisionModule {}
