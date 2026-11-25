import { Injectable } from '@nestjs/common';

import {
  buildImprovementRecommendations,
  buildReview,
  currentStage,
  detectBottlenecks,
  detectDeviations,
  discoverImprovementOpportunities,
  evaluateActionOutcome,
  evidenceStillCurrent,
  monitorPlan,
  type ActionObservation,
  type BottleneckSignals,
  type MetricObservation,
  type PlanObservation,
  type Thresholds,
} from './continuous-improvement';

@Injectable()
export class ImprovementCycleService {
  stage(input: Parameters<typeof currentStage>[0]) {
    return { stages: ['OBSERVE', 'ANALYZE', 'IDENTIFY', 'RECOMMEND', 'PLAN', 'APPROVE', 'EXECUTE', 'MEASURE', 'EVALUATE', 'IMPROVE'], current: currentStage(input) };
  }
}

@Injectable()
export class PerformanceEvaluationService {
  detect(metrics: MetricObservation[], thresholds: Thresholds, detectedAt: string) {
    return detectDeviations(metrics, thresholds, detectedAt);
  }
}

@Injectable()
export class PlanProgressMonitoringService {
  assess(plans: PlanObservation[], now: Date, thresholds: Thresholds) {
    return plans.map((plan) => monitorPlan(plan, now, thresholds));
  }
}

@Injectable()
export class BottleneckDetectionService {
  detect(signals: BottleneckSignals, thresholds: Thresholds, periodKey: string) {
    return detectBottlenecks(signals, thresholds, periodKey);
  }
}

@Injectable()
export class ImprovementOpportunityService {
  discover(input: Parameters<typeof discoverImprovementOpportunities>[0]) {
    return discoverImprovementOpportunities(input);
  }
}

@Injectable()
export class OutcomeAnalysisService {
  evaluate(actions: ActionObservation[], now: Date, thresholds: Thresholds) {
    return actions.map((action) => ({
      ...action,
      ...evaluateActionOutcome(action, now, thresholds),
    }));
  }
}

@Injectable()
export class ImprovementRecommendationService {
  draft(input: Parameters<typeof buildImprovementRecommendations>[0]) {
    return buildImprovementRecommendations(input);
  }

  stillCurrent(key: string, keys: string[]) {
    return evidenceStillCurrent(key, keys);
  }
}

@Injectable()
export class ImprovementEvidenceService {
  stillCurrent(key: string, keys: string[]) {
    return evidenceStillCurrent(key, keys);
  }
}

export { buildReview };
