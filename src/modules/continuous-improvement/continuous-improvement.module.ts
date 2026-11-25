import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { BusinessIntelligenceModule } from '../business-intelligence/business-intelligence.module';
import { ContinuousImprovementController } from './continuous-improvement.controller';
import { ContinuousImprovementProcessor } from './continuous-improvement.processor';
import { ContinuousImprovementScheduler } from './continuous-improvement.scheduler';
import { ContinuousImprovementService } from './continuous-improvement.service';
import {
  BottleneckDetectionService,
  ImprovementCycleService,
  ImprovementEvidenceService,
  ImprovementOpportunityService,
  ImprovementRecommendationService,
  OutcomeAnalysisService,
  PerformanceEvaluationService,
  PlanProgressMonitoringService,
} from './improvement-engines';
import { ImprovementHistoryService } from './improvement-history.service';
import { ImprovementMetricsService } from './improvement-metrics.service';

@Module({
  imports: [BusinessIntelligenceModule, BullModule.registerQueue({ name: QUEUE_NAMES.CONTINUOUS_IMPROVEMENT })],
  controllers: [ContinuousImprovementController],
  providers: [
    ImprovementMetricsService,
    ImprovementHistoryService,
    ImprovementCycleService,
    PerformanceEvaluationService,
    PlanProgressMonitoringService,
    BottleneckDetectionService,
    ImprovementOpportunityService,
    ImprovementRecommendationService,
    ImprovementEvidenceService,
    OutcomeAnalysisService,
    ContinuousImprovementService,
    ContinuousImprovementProcessor,
    ContinuousImprovementScheduler,
  ],
  exports: [ContinuousImprovementService],
})
export class ContinuousImprovementModule {}
