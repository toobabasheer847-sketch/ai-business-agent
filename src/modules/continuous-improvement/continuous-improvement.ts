import { goalProgress } from '../strategic-decisions/strategic-decision';

export const IMPROVEMENT_CYCLE = [
  'OBSERVE',
  'ANALYZE',
  'IDENTIFY',
  'RECOMMEND',
  'PLAN',
  'APPROVE',
  'EXECUTE',
  'MEASURE',
  'EVALUATE',
  'IMPROVE',
] as const;

export type CycleStage = (typeof IMPROVEMENT_CYCLE)[number];

export const OUTCOME_STATUSES = [
  'NOT_EVALUATED',
  'PENDING_MEASUREMENT',
  'POSITIVE_OBSERVED_CHANGE',
  'NEGATIVE_OBSERVED_CHANGE',
  'NO_MEASURABLE_CHANGE',
  'INCONCLUSIVE',
  'INSUFFICIENT_DATA',
] as const;

export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export const PROGRESS_STATUSES = [
  'on_track',
  'at_risk',
  'stalled',
  'overdue',
  'completed',
  'insufficient_data',
] as const;

export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export type Thresholds = {
  stalledDays: number;
  deviationPercent: number;
  ratePoints: number;
  minAbsolute: number;
  minSample: number;
  inactiveLeadCount: number;
  pendingProposalCount: number;
  workflowFailureCount: number;
  overdueTaskCount: number;
  exceptionRepeatCount: number;
  concentrationShare: number;
  concentrationMin: number;
  measurementDays: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  stalledDays: 14,
  deviationPercent: 10,
  ratePoints: 5,
  minAbsolute: 1,
  minSample: 8,
  inactiveLeadCount: 3,
  pendingProposalCount: 3,
  workflowFailureCount: 3,
  overdueTaskCount: 5,
  exceptionRepeatCount: 2,
  concentrationShare: 0.6,
  concentrationMin: 5,
  measurementDays: 28,
};

export type MetricObservation = {
  key: string;
  name: string;
  unit: 'count' | 'rate' | 'hours';
  direction: 'higher' | 'lower';
  current: number | null;
  baseline: number | null;
  previous: number | null;
  target: number | null;
  expected: number | null;
  sample: number;
  currency: string | null;
  expectedCurrency: string | null;
  comparisonPeriod: string;
  evidence: string;
};

export type Deviation = {
  metricKey: string;
  metricName: string;
  deviationType: 'POSITIVE' | 'NEGATIVE' | 'UNEXPECTED' | 'TARGET_GAP' | 'STAGNATION' | 'TREND_REVERSAL';
  currentValue: number | null;
  baselineValue: number | null;
  targetValue: number | null;
  deviationValue: number | null;
  deviationPercentage: number | null;
  comparisonPeriod: string;
  trendDirection: 'up' | 'down' | 'flat' | 'unknown';
  evidence: string[];
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedAt: string;
};

export type PlanObservation = {
  id: string;
  title: string;
  status: string;
  planKind: string;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  metricKey: string | null;
  direction: 'higher' | 'lower' | null;
  baseline: number | null;
  current: number | null;
  target: number | null;
  milestones: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  steps: Array<{ id: string; title: string; status: string; completedAt: string | null }>;
};

export type PlanAssessment = {
  planId: string;
  title: string;
  storedStatus: string;
  progressStatus: ProgressStatus;
  executionProgress: number | null;
  outcomeProgress: number | null;
  reason: string;
};

export type BottleneckSignals = {
  inactiveLeads: number;
  staleProspects: number;
  oldPendingProposals: number;
  overdueTasks: number;
  openTasks: number;
  overdueShare: number | null;
  openExceptions: number;
  repeatedExceptions: Array<{ id: string; title: string; count: number }>;
  workflowFailures: number;
  failedSteps: number;
  approvalDelays: number;
  providerFailures: number;
  retryingExecutions: number;
  incompleteMilestonePlans: number;
  goalsWithoutProgress: number;
  blockedSteps: number;
  plansWaitingApproval: number;
};

export type Bottleneck = {
  fingerprint: string;
  category: 'sales' | 'operations' | 'automation' | 'strategic';
  title: string;
  description: string;
  affectedProcess: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  severity: 'low' | 'medium' | 'high';
  detectionMethod: 'count_threshold' | 'recurrence' | 'share_concentration';
  recommendedInvestigation: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
  supportingMetrics: Record<string, number>;
};

export type Opportunity = {
  key: string;
  title: string;
  category: string;
  description: string;
  evidence: string[];
  affectedMetric: string;
  potentialBenefit: string;
  expectedEffort: null;
  priority: 'low' | 'medium' | 'high';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedImprovement: string;
  reviewRequired: true;
};

export type RecommendationDraft = {
  key: string;
  title: string;
  description: string;
  category: string;
  evidence: string[];
  reasoning: string;
  priority: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  expectedOutcome: string;
  risks: string;
  suggestedImprovement: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  requiredPermission: 'analytics.view';
  approvalRequired: false;
};

export type ActionObservation = {
  actionPlanId: string;
  title: string;
  status: string;
  metricKey: string | null;
  goalId: string | null;
  direction: 'higher' | 'lower';
  baseline: number | null;
  measured: number | null;
  completedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  overlapping: boolean;
};

const CAUSAL_LIMIT =
  'This describes an observed change. It does not show that an action caused the change.';

export function parseThresholds(raw: Record<string, string | undefined>): Thresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    stalledDays: boundedInt(raw.IMPROVEMENT_STALLED_DAYS, 14, 1, 90),
    deviationPercent: boundedInt(raw.IMPROVEMENT_DEVIATION_PERCENT, 10, 1, 100),
    ratePoints: boundedInt(raw.IMPROVEMENT_RATE_POINTS, 5, 1, 50),
    minSample: boundedInt(raw.IMPROVEMENT_MIN_SAMPLE, 8, 1, 1000),
    measurementDays: boundedInt(raw.IMPROVEMENT_MEASUREMENT_DAYS, 28, 7, 90),
  };
}

export function percentChange(current: number | null, baseline: number | null) {
  if (current === null || baseline === null) {
    return { percent: null as number | null, reason: 'A current or baseline value is missing.' };
  }
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return { percent: null as number | null, reason: 'A value is not a finite number.' };
  }
  if (baseline === 0) {
    return { percent: null as number | null, reason: 'Percentage was withheld because the baseline is zero.' };
  }
  if (baseline < 0) {
    return { percent: null as number | null, reason: 'Percentage was withheld because the baseline is negative.' };
  }
  const raw = ((current - baseline) / baseline) * 100;
  if (!Number.isFinite(raw) || Math.abs(raw) > 100000) {
    return { percent: null as number | null, reason: 'Percentage was withheld because the ratio is not stable.' };
  }
  return { percent: Math.round(raw * 10) / 10, reason: null as string | null };
}

export function currenciesCompatible(left: string | null, right: string | null) {
  if (!left || !right) return true;
  return left.toUpperCase() === right.toUpperCase();
}

export function detectDeviations(
  metrics: MetricObservation[],
  thresholds: Thresholds,
  detectedAt: string,
): Deviation[] {
  const found: Deviation[] = [];
  for (const metric of metrics) {
    if (!currenciesCompatible(metric.currency, metric.expectedCurrency)) {
      continue;
    }
    if (metric.current === null) continue;
    if (metric.unit === 'rate' && metric.sample < thresholds.minSample) continue;
    const trend = trendDirection(metric.previous, metric.current);
    const reversal = isReversal(metric, thresholds);
    if (reversal) {
      found.push(
        deviation(metric, 'TREND_REVERSAL', metric.previous, null, trend, detectedAt, thresholds, [
          `${metric.name} moved from ${formatValue(metric.baseline)} to ${formatValue(metric.previous)} and then to ${formatValue(metric.current)}.`,
          'This is a two-period comparison. It is not a statistical significance test.',
          metric.evidence,
        ]),
      );
    } else if (metric.baseline !== null && isMaterial(metric.current, metric.baseline, metric, thresholds)) {
      const positive = metric.direction === 'higher' ? metric.current > metric.baseline : metric.current < metric.baseline;
      const ratio = metric.unit === 'rate' ? { percent: null, reason: 'Rate changes are reported in percentage points, not as a percent of the prior rate.' } : percentChange(metric.current, metric.baseline);
      found.push(
        deviation(
          metric,
          positive ? 'POSITIVE' : 'NEGATIVE',
          metric.baseline,
          ratio.percent,
          trend,
          detectedAt,
          thresholds,
          [
            `${metric.name} is ${formatValue(metric.current)} compared with a baseline of ${formatValue(metric.baseline)}.`,
            ratio.reason ?? `The percentage change is ${ratio.percent}%.`,
            'The comparison does not claim statistical significance.',
            metric.evidence,
          ],
        ),
      );
    }
    if (metric.target !== null && metric.baseline !== null && targetGap(metric, thresholds)) {
      found.push(
        deviation(metric, 'TARGET_GAP', metric.baseline, null, trend, detectedAt, thresholds, [
          `${metric.name} is ${formatValue(metric.current)} and the target is ${formatValue(metric.target)}.`,
          'The gap is the distance still left toward the target. It is not a forecast.',
          metric.evidence,
        ]),
      );
    }
    if (
      metric.previous !== null &&
      metric.current === metric.previous &&
      metric.target !== null &&
      !meetsTarget(metric)
    ) {
      found.push(
        deviation(metric, 'STAGNATION', metric.previous, null, 'flat', detectedAt, thresholds, [
          `${metric.name} stayed at ${formatValue(metric.current)} across the comparison period while the target is ${formatValue(metric.target)}.`,
          metric.evidence,
        ]),
      );
    }
    if (
      metric.expected !== null &&
      currenciesCompatible(metric.currency, metric.expectedCurrency) &&
      isMaterial(metric.current, metric.expected, metric, thresholds)
    ) {
      const ratio = percentChange(metric.current, metric.expected);
      found.push(
        deviation(metric, 'UNEXPECTED', metric.expected, ratio.percent, trend, detectedAt, thresholds, [
          `${metric.name} is ${formatValue(metric.current)} compared with an expected value of ${formatValue(metric.expected)}.`,
          'The expected value is a stored forecast or plan figure, not a guaranteed result.',
          ratio.reason ?? `The percentage difference from the expected value is ${ratio.percent}%.`,
          metric.evidence,
        ]),
      );
    }
  }
  return dedupeBy(found, (item) => `${item.metricKey}:${item.deviationType}`);
}

export function monitorPlan(plan: PlanObservation, now: Date, thresholds: Thresholds): PlanAssessment {
  const items = plan.milestones.length + plan.steps.length;
  const done =
    plan.milestones.filter((item) => item.status === 'completed').length +
    plan.steps.filter((item) => item.status === 'completed').length;
  const executionProgress = items === 0 ? null : Math.round((done / items) * 100);
  const outcome = goalProgress({
    direction: plan.direction ?? 'lower',
    baseline: plan.baseline,
    current: plan.current,
    target: plan.target,
  });
  const outcomeProgress = plan.direction && plan.baseline !== null && plan.current !== null && plan.target !== null ? outcome.progress : null;
  const incompleteMilestone = plan.milestones.some((item) => item.status !== 'completed');
  const incompleteStep = plan.steps.some((item) => item.status !== 'completed' && item.status !== 'cancelled');
  const milestoneOverdue = plan.milestones.some(
    (item) => item.status !== 'completed' && item.dueDate !== null && new Date(item.dueDate).getTime() < now.getTime(),
  );
  const targetPassed = plan.targetDate !== null && new Date(plan.targetDate).getTime() < now.getTime();
  const lastActivity = latestActivity(plan);
  const quietMs = now.getTime() - lastActivity.getTime();
  const stalled = quietMs > thresholds.stalledDays * 24 * 60 * 60 * 1000;

  if (plan.status === 'COMPLETED') {
    if (items === 0) {
      return assessment(plan, 'insufficient_data', executionProgress, outcomeProgress, 'The plan is marked completed, but it has no milestones or steps that confirm completion. Execution progress and outcome progress are separate.');
    }
    if (incompleteMilestone || incompleteStep) {
      return assessment(plan, 'at_risk', executionProgress, outcomeProgress, 'The stored status is completed, but a milestone or step is still incomplete. The stored status was not changed.');
    }
    return assessment(plan, 'completed', executionProgress, outcomeProgress, 'The plan is marked completed and every stored milestone and step is complete. Completing the work items is not treated as proof that the business target was achieved.');
  }
  if (items === 0 && outcomeProgress === null) {
    return assessment(plan, 'insufficient_data', null, null, 'There are no milestones, steps, or comparable goal values, so progress cannot be judged from the plan description.');
  }
  if ((targetPassed && (incompleteMilestone || incompleteStep || items === 0)) || milestoneOverdue) {
    return assessment(plan, 'overdue', executionProgress, outcomeProgress, 'A target date or milestone due date has passed with work still incomplete. This uses stored dates, not the plan description.');
  }
  if (stalled && plan.status === 'ACTIVE') {
    return assessment(plan, 'stalled', executionProgress, outcomeProgress, `No milestone, step, or plan update was stored in the last ${thresholds.stalledDays} days.`);
  }
  const expected = expectedFraction(plan.createdAt, plan.targetDate, now);
  if (expected !== null && expected >= 0.25) {
    if (outcomeProgress !== null && outcomeProgress + 15 < expected * 100) {
      return assessment(plan, 'at_risk', executionProgress, outcomeProgress, `Outcome progress is ${outcomeProgress}% while about ${Math.round(expected * 100)}% of the time to the target date has passed. Execution progress is reported separately and is not treated as the business result.`);
    }
    if (executionProgress !== null && executionProgress + 15 < expected * 100) {
      return assessment(plan, 'at_risk', executionProgress, outcomeProgress, `Execution progress is ${executionProgress}% while about ${Math.round(expected * 100)}% of the time to the target date has passed. That is work-item progress, not proof of the business outcome.`);
    }
  }
  return assessment(plan, 'on_track', executionProgress, outcomeProgress, 'Stored milestones, steps, and any available goal values are within the configured schedule. This is not a claim that the business target will be met.');
}

export function detectBottlenecks(
  signals: BottleneckSignals,
  thresholds: Thresholds,
  periodKey: string,
): Bottleneck[] {
  const items: Bottleneck[] = [];
  if (signals.inactiveLeads >= thresholds.inactiveLeadCount) {
    items.push(bottleneck({
      code: 'inactive_leads',
      periodKey,
      category: 'sales',
      title: 'Leads are remaining inactive',
      description: `${signals.inactiveLeads} leads are still new after the configured inactivity window.`,
      process: 'Lead follow-up',
      severity: signals.inactiveLeads >= thresholds.inactiveLeadCount * 2 ? 'high' : 'medium',
      method: 'count_threshold',
      investigation: 'Review the inactive lead list. This is an observed count, not a confirmed cause, and it does not name a person.',
      confidence: 'HIGH',
      evidence: [`${signals.inactiveLeads} leads are still new.`],
      metrics: { inactiveLeads: signals.inactiveLeads },
    }));
  }
  if (signals.staleProspects >= thresholds.inactiveLeadCount) {
    items.push(bottleneck({
      code: 'stale_prospects',
      periodKey,
      category: 'sales',
      title: 'Prospects are not progressing',
      description: `${signals.staleProspects} prospects are still new or contacted and were last updated before the inactivity window.`,
      process: 'Prospect progression',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review prospect statuses. The count shows a lack of recorded progression, not why it happened.',
      confidence: 'MEDIUM',
      evidence: [`${signals.staleProspects} prospects have no recent status change.`],
      metrics: { staleProspects: signals.staleProspects },
    }));
  }
  if (signals.oldPendingProposals >= thresholds.pendingProposalCount) {
    items.push(bottleneck({
      code: 'pending_proposals',
      periodKey,
      category: 'sales',
      title: 'Proposals are pending for a long period',
      description: `${signals.oldPendingProposals} sent or viewed proposals are older than 14 days and have no decision.`,
      process: 'Proposal follow-up',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review the pending proposal list and identify delays in the follow-up record. No revenue impact is estimated.',
      confidence: 'HIGH',
      evidence: [`${signals.oldPendingProposals} proposals have no decision after 14 days.`],
      metrics: { oldPendingProposals: signals.oldPendingProposals },
    }));
  }
  if (signals.overdueTasks >= thresholds.overdueTaskCount) {
    items.push(bottleneck({
      code: 'overdue_tasks',
      periodKey,
      category: 'operations',
      title: 'Tasks are repeatedly past their due time',
      description: `${signals.overdueTasks} open tasks have a due time before now.`,
      process: 'Task completion',
      severity: signals.overdueTasks >= thresholds.overdueTaskCount * 2 ? 'high' : 'medium',
      method: 'count_threshold',
      investigation: 'Review the overdue task list and deadline distribution. Do not treat the count as a judgment of an individual employee.',
      confidence: 'HIGH',
      evidence: [`${signals.overdueTasks} open tasks are overdue.`],
      metrics: { overdueTasks: signals.overdueTasks },
    }));
  }
  if (
    signals.overdueShare !== null &&
    signals.overdueTasks >= thresholds.concentrationMin &&
    signals.overdueShare >= thresholds.concentrationShare
  ) {
    items.push(bottleneck({
      code: 'concentrated_overdue',
      periodKey,
      category: 'operations',
      title: 'Pending overdue work is concentrated',
      description: `${Math.round(signals.overdueShare * 100)}% of ${signals.overdueTasks} overdue tasks sit with one assignment group.`,
      process: 'Task assignment',
      severity: 'medium',
      method: 'share_concentration',
      investigation: 'Review assignment distribution with a manager. The share is a correlation in the task table, not a confirmed cause, and no employee is named.',
      confidence: 'MEDIUM',
      evidence: [`One assignment group holds ${Math.round(signals.overdueShare * 100)}% of overdue tasks.`],
      metrics: { overdueShare: Math.round(signals.overdueShare * 100), overdueTasks: signals.overdueTasks },
    }));
  }
  const repeated = signals.repeatedExceptions.filter((item) => item.count >= thresholds.exceptionRepeatCount);
  if (repeated.length > 0) {
    const top = [...repeated].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))[0];
    items.push(bottleneck({
      code: 'repeated_exceptions',
      periodKey,
      category: 'operations',
      title: 'An operational exception keeps reappearing',
      description: `${repeated.length} open exceptions have been detected more than once. The highest stored count is ${top.count} for "${top.title}".`,
      process: 'Exception resolution',
      severity: top.count >= 5 ? 'high' : 'medium',
      method: 'recurrence',
      investigation: 'Investigate the recurring exception pattern. Do not open a second exception for the same finding.',
      confidence: 'HIGH',
      evidence: repeated.slice(0, 5).map((item) => `${item.title} was detected ${item.count} times.`),
      metrics: { repeatedExceptions: repeated.length },
      relatedEntityType: 'operational_exception',
      relatedEntityId: top.id,
    }));
  }
  if (signals.workflowFailures >= thresholds.workflowFailureCount) {
    items.push(bottleneck({
      code: 'workflow_failures',
      periodKey,
      category: 'automation',
      title: 'Workflow executions are failing',
      description: `${signals.workflowFailures} workflow executions failed or partly completed in the current 30-day window.`,
      process: 'Workflow execution',
      severity: signals.workflowFailures >= thresholds.workflowFailureCount * 2 ? 'high' : 'medium',
      method: 'count_threshold',
      investigation: 'Open workflow analytics and inspect the shared failure before increasing automation. The count is not a cause by itself.',
      confidence: 'HIGH',
      evidence: [`${signals.workflowFailures} failed or partial executions were stored.`],
      metrics: { workflowFailures: signals.workflowFailures, failedSteps: signals.failedSteps },
    }));
  }
  if (signals.failedSteps >= thresholds.workflowFailureCount) {
    items.push(bottleneck({
      code: 'failed_steps',
      periodKey,
      category: 'automation',
      title: 'Automation steps are failing',
      description: `${signals.failedSteps} workflow steps failed in the current 30-day window.`,
      process: 'Workflow step',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Inspect the failed step records. A repeated step failure is a pattern, not proof of a single configuration cause until someone reviews it.',
      confidence: 'MEDIUM',
      evidence: [`${signals.failedSteps} step rows have a failed status.`],
      metrics: { failedSteps: signals.failedSteps },
    }));
  }
  if (signals.approvalDelays >= 3) {
    items.push(bottleneck({
      code: 'approval_delays',
      periodKey,
      category: 'automation',
      title: 'Approvals are waiting',
      description: `${signals.approvalDelays} approval requests have been pending for more than three days.`,
      process: 'Approval Center',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review the pending approvals. This monitor does not approve or reject them.',
      confidence: 'HIGH',
      evidence: [`${signals.approvalDelays} approvals are older than three days and still pending.`],
      metrics: { approvalDelays: signals.approvalDelays },
    }));
  }
  if (signals.providerFailures >= thresholds.workflowFailureCount) {
    items.push(bottleneck({
      code: 'provider_failures',
      periodKey,
      category: 'automation',
      title: 'AI provider calls are failing',
      description: `${signals.providerFailures} agent runs failed in the current 30-day window.`,
      process: 'AI agent monitoring',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review AI monitoring for the failed runs. No model was retrained from this finding.',
      confidence: 'HIGH',
      evidence: [`${signals.providerFailures} agent runs have a failed status.`],
      metrics: { providerFailures: signals.providerFailures },
    }));
  }
  if (signals.retryingExecutions >= thresholds.workflowFailureCount) {
    items.push(bottleneck({
      code: 'workflow_retries',
      periodKey,
      category: 'automation',
      title: 'Workflow runs are retrying',
      description: `${signals.retryingExecutions} workflow executions are in retry.`,
      process: 'Workflow retry',
      severity: 'low',
      method: 'count_threshold',
      investigation: 'Review the retrying executions before starting more runs.',
      confidence: 'MEDIUM',
      evidence: [`${signals.retryingExecutions} executions are marked retrying.`],
      metrics: { retryingExecutions: signals.retryingExecutions },
    }));
  }
  if (signals.incompleteMilestonePlans >= 1) {
    items.push(bottleneck({
      code: 'incomplete_milestones',
      periodKey,
      category: 'strategic',
      title: 'Active plans have overdue milestones',
      description: `${signals.incompleteMilestonePlans} active plans have a milestone whose due date has passed.`,
      process: 'Strategic plan',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review the overdue milestones and the execution schedule. The plan status was not changed automatically.',
      confidence: 'HIGH',
      evidence: [`${signals.incompleteMilestonePlans} active plans have an overdue milestone.`],
      metrics: { incompleteMilestonePlans: signals.incompleteMilestonePlans },
    }));
  }
  if (signals.goalsWithoutProgress >= 1) {
    items.push(bottleneck({
      code: 'goals_without_progress',
      periodKey,
      category: 'strategic',
      title: 'Goals have no measurable progress',
      description: `${signals.goalsWithoutProgress} active goals have no current movement from the baseline toward the target.`,
      process: 'Business goal',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review whether the metric is being captured and whether the target still fits the stored results.',
      confidence: 'MEDIUM',
      evidence: [`${signals.goalsWithoutProgress} goals show no measurable progress.`],
      metrics: { goalsWithoutProgress: signals.goalsWithoutProgress },
    }));
  }
  if (signals.blockedSteps >= 1) {
    items.push(bottleneck({
      code: 'blocked_steps',
      periodKey,
      category: 'strategic',
      title: 'Action steps are blocked',
      description: `${signals.blockedSteps} action steps are failed or waiting for approval.`,
      process: 'Action plan',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Open the blocked steps. Waiting approvals stay in the Approval Center.',
      confidence: 'HIGH',
      evidence: [`${signals.blockedSteps} steps are failed or awaiting approval.`],
      metrics: { blockedSteps: signals.blockedSteps },
    }));
  }
  if (signals.plansWaitingApproval >= 1) {
    items.push(bottleneck({
      code: 'plans_waiting_approval',
      periodKey,
      category: 'strategic',
      title: 'Plans are waiting on approvals',
      description: `${signals.plansWaitingApproval} plans have a step that is still awaiting approval.`,
      process: 'Approval-dependent plan',
      severity: 'medium',
      method: 'count_threshold',
      investigation: 'Review the linked approvals. This finding does not approve them.',
      confidence: 'HIGH',
      evidence: [`${signals.plansWaitingApproval} plans have an awaiting-approval step.`],
      metrics: { plansWaitingApproval: signals.plansWaitingApproval },
    }));
  }
  return dedupeBy(items, (item) => item.fingerprint);
}

export function discoverImprovementOpportunities(input: {
  workflowFailures: number;
  overdueTasks: number;
  previousOverdueTasks: number | null;
  oldPendingProposals: number;
  goalsBehindTarget: number;
  repeatedExceptions: number;
}): Opportunity[] {
  const items: Opportunity[] = [];
  if (input.workflowFailures >= 3) {
    items.push(opportunity(
      'workflow_configuration',
      'Review repeated workflow failures',
      'automation',
      'Workflow executions failed or partly completed often enough to review the configuration.',
      [`${input.workflowFailures} failed or partial executions were stored in the current window.`],
      'workflow_failure_count',
      'A review can show whether the same failure is repeating. No time saving is calculated.',
      'HIGH',
      'Review the workflow configuration and investigate the repeated failure pattern.',
    ));
  }
  if (input.previousOverdueTasks !== null && input.overdueTasks > input.previousOverdueTasks) {
    items.push(opportunity(
      'task_deadlines',
      'Review task deadline distribution',
      'operations',
      'The overdue task count is higher than the previous stored comparison.',
      [`Overdue tasks are ${input.overdueTasks} compared with ${input.previousOverdueTasks}.`],
      'overdue_task_count',
      'A review can show where deadlines cluster. No productivity gain is estimated.',
      'MEDIUM',
      'Review task deadline distribution and assignment patterns.',
    ));
  }
  if (input.oldPendingProposals >= 3) {
    items.push(opportunity(
      'proposal_follow_up',
      'Review proposal pending duration',
      'sales',
      'Several proposals have stayed pending past 14 days.',
      [`${input.oldPendingProposals} proposals are pending without a decision.`],
      'old_pending_proposals',
      'A review can show where follow-up records stop. No acceptance-rate change is estimated.',
      'HIGH',
      'Review the proposal follow-up process and identify possible delays.',
    ));
  }
  if (input.goalsBehindTarget >= 1) {
    items.push(opportunity(
      'goal_strategy',
      'Review goals that remain behind target',
      'strategy',
      'At least one active goal is still on the wrong side of its target after the schedule midpoint.',
      [`${input.goalsBehindTarget} goals are behind the stored target.`],
      'business_goal',
      'A review can show whether the target or the action plan should change. No improvement percentage is promised.',
      'MEDIUM',
      'Review the current strategy and evaluate whether the target or action plan needs adjustment.',
    ));
  }
  if (input.repeatedExceptions >= 1) {
    items.push(opportunity(
      'recurring_exception',
      'Review a recurring operational exception',
      'operations',
      'An exception has been detected again after earlier occurrences.',
      [`${input.repeatedExceptions} open exceptions have a stored occurrence count above one.`],
      'exception_occurrence_count',
      'Looking at the pattern can avoid treating each occurrence as a new issue. No cost avoidance is calculated.',
      'HIGH',
      'Investigate the underlying recurring issue rather than only resolving the individual exception.',
    ));
  }
  return dedupeBy(items, (item) => item.key);
}

export function buildImprovementRecommendations(input: {
  plans: PlanAssessment[];
  deviations: Deviation[];
  bottlenecks: Bottleneck[];
  opportunities: Opportunity[];
}): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  for (const plan of input.plans) {
    if (plan.progressStatus === 'overdue' || plan.progressStatus === 'at_risk') {
      drafts.push(recommendation(
        `plan:${plan.planId}:schedule`,
        'Review overdue milestones and revise the execution schedule',
        `${plan.title} is ${plan.progressStatus.replaceAll('_', ' ')}. ${plan.reason}`,
        'strategy',
        [plan.reason],
        'The status comes from stored dates and work items. The plan itself was not modified.',
        plan.progressStatus === 'overdue' ? 80 : 60,
        'HIGH',
        'A person can revise dates or milestones. The business target is not guaranteed to move.',
        plan.planId,
        'strategic_plan',
      ));
    }
    if (plan.progressStatus === 'stalled') {
      drafts.push(recommendation(
        `plan:${plan.planId}:stalled`,
        'Review an inactive plan',
        `${plan.title} has no recent stored activity. ${plan.reason}`,
        'strategy',
        [plan.reason],
        'Inactivity is measured from stored update times, not from the plan text.',
        70,
        'HIGH',
        'A person can decide whether to resume, hold, or cancel the plan.',
        plan.planId,
        'strategic_plan',
      ));
    }
    if (plan.executionProgress === 100 && plan.outcomeProgress !== null && plan.outcomeProgress < 25) {
      drafts.push(recommendation(
        `plan:${plan.planId}:outcome`,
        'Review whether the current strategy is producing measurable outcomes',
        `${plan.title} has completed its stored work items, while outcome progress is ${plan.outcomeProgress}%.`,
        'strategy',
        [plan.reason, 'Completed work items and the business metric are reported separately.'],
        'Completing steps is not treated as evidence that the metric moved because of those steps.',
        75,
        'MEDIUM',
        'A person can compare the metric with the completed work and decide whether the plan should change.',
        plan.planId,
        'strategic_plan',
      ));
    }
  }
  for (const item of input.deviations) {
    if (item.deviationType === 'POSITIVE' || item.deviationType === 'STAGNATION') continue;
    drafts.push(recommendation(
      `deviation:${item.metricKey}:${item.deviationType}`,
      `Review the ${item.metricName.toLowerCase()} ${item.deviationType === 'TARGET_GAP' ? 'target gap' : 'change'}`,
      item.evidence[0] ?? item.metricName,
      'performance',
      item.evidence,
      'The deviation uses stored values and a configured threshold. It is not a significance test.',
      item.deviationType === 'NEGATIVE' || item.deviationType === 'TREND_REVERSAL' ? 70 : 55,
      item.confidenceLevel,
      'A person can investigate the metric. No automatic target change is made.',
      null,
      null,
    ));
  }
  for (const item of input.bottlenecks) {
    drafts.push(recommendation(
      `bottleneck:${item.fingerprint}`,
      item.title,
      item.description,
      item.category,
      [...item.evidence, item.recommendedInvestigation],
      `Detection method: ${item.detectionMethod}. The finding is an observed pattern, not a confirmed cause.`,
      item.severity === 'high' ? 80 : item.severity === 'medium' ? 60 : 40,
      item.confidenceLevel,
      'A person can investigate the related records. No exception was created from this recommendation.',
      item.relatedEntityId,
      item.relatedEntityType,
    ));
  }
  for (const item of input.opportunities) {
    drafts.push(recommendation(
      `opportunity:${item.key}`,
      item.title,
      item.suggestedImprovement,
      item.category,
      item.evidence,
      item.potentialBenefit,
      item.priority === 'high' ? 50 : 35,
      item.confidence,
      item.potentialBenefit,
      null,
      null,
    ));
  }
  return dedupeBy(drafts, (item) => item.key);
}

export function evaluateActionOutcome(
  action: ActionObservation,
  now: Date,
  thresholds: Thresholds,
): { status: OutcomeStatus; statement: string } {
  if (action.status === 'failed') {
    return { status: 'NOT_EVALUATED', statement: 'The action failed, so no business outcome was inferred from it.' };
  }
  if (action.status !== 'completed') {
    return { status: 'NOT_EVALUATED', statement: 'The action is not completed, so it was not evaluated.' };
  }
  if (action.overlapping) {
    return {
      status: 'INCONCLUSIVE',
      statement: 'Another completed action uses the same metric in an overlapping window, so this result is inconclusive and was not double counted as a separate cause.',
    };
  }
  if (!action.periodStart || !action.periodEnd) {
    return { status: 'INSUFFICIENT_DATA', statement: 'The measurement window is missing, so the action was not evaluated.' };
  }
  if (now.getTime() < new Date(action.periodEnd).getTime()) {
    return {
      status: 'PENDING_MEASUREMENT',
      statement: `The measurement window runs until ${action.periodEnd}. The outcome is not evaluated before that time.`,
    };
  }
  if (!action.metricKey || action.baseline === null || action.measured === null) {
    return {
      status: 'INSUFFICIENT_DATA',
      statement: 'A baseline or a measurement stored inside the evaluation window is missing, so no outcome number was invented.',
    };
  }
  const ratio = action.metricKey.includes('rate')
    ? { percent: null as number | null, reason: 'Rate changes stay in percentage points.' }
    : percentChange(action.measured, action.baseline);
  const delta = action.measured - action.baseline;
  const material = action.metricKey.includes('rate')
    ? Math.abs(delta) >= thresholds.ratePoints
    : ratio.percent === null
      ? Math.abs(delta) >= thresholds.minAbsolute
      : Math.abs(ratio.percent) >= thresholds.deviationPercent && Math.abs(delta) >= thresholds.minAbsolute;
  if (!material) {
    return {
      status: 'NO_MEASURABLE_CHANGE',
      statement: `${action.title}: the metric was ${formatValue(action.baseline)} at baseline and ${formatValue(action.measured)} in the measurement window. The difference is inside the configured threshold. ${CAUSAL_LIMIT}`,
    };
  }
  const improved = action.direction === 'higher' ? action.measured > action.baseline : action.measured < action.baseline;
  return {
    status: improved ? 'POSITIVE_OBSERVED_CHANGE' : 'NEGATIVE_OBSERVED_CHANGE',
    statement: `${action.title}: the metric was ${formatValue(action.baseline)} at baseline and ${formatValue(action.measured)} during the measurement window. ${CAUSAL_LIMIT}`,
  };
}

export function windowsOverlap(
  left: { start: string; end: string; metricKey: string },
  right: { start: string; end: string; metricKey: string },
) {
  if (left.metricKey !== right.metricKey) return false;
  return new Date(left.start).getTime() <= new Date(right.end).getTime() && new Date(right.start).getTime() <= new Date(left.end).getTime();
}

export function buildReview(input: {
  periodStart: string;
  periodEnd: string;
  metrics: MetricObservation[];
  goals: Array<{ name: string; progress: number | null; note: string }>;
  plans: PlanAssessment[];
  completedActions: number;
  failedActions: number;
  bottlenecks: Bottleneck[];
  opportunities: Opportunity[];
  outcomes: Array<{ title: string; status: OutcomeStatus; statement: string }>;
}) {
  const lines = [
    `Improvement review for ${input.periodStart} through ${input.periodEnd}. Figures come from stored records.`,
    input.metrics.length === 0
      ? 'No comparable business metric was available for this period.'
      : input.metrics
          .slice(0, 8)
          .map((metric) => `${metric.name}: current ${formatValue(metric.current)}, baseline ${formatValue(metric.baseline)}, target ${formatValue(metric.target)}.`)
          .join(' '),
    input.goals.length === 0
      ? 'No active goals were stored.'
      : input.goals.map((goal) => `${goal.name}: ${goal.note}`).join(' '),
    input.plans.length === 0
      ? 'No active plans were stored.'
      : input.plans.map((plan) => `${plan.title} is ${plan.progressStatus.replaceAll('_', ' ')}. ${plan.reason}`).join(' '),
    `Completed action plans in the records used for this review: ${input.completedActions}. Failed action plans: ${input.failedActions}.`,
    input.bottlenecks.length === 0
      ? 'No bottleneck rule matched.'
      : input.bottlenecks.map((item) => `${item.title}. ${item.recommendedInvestigation}`).join(' '),
    input.opportunities.length === 0
      ? 'No improvement opportunity rule matched.'
      : input.opportunities.map((item) => item.suggestedImprovement).join(' '),
    input.outcomes.length === 0
      ? 'No outcome evaluation was available.'
      : input.outcomes.map((item) => `${item.status}: ${item.statement}`).join(' '),
    'A review is complete only after a person marks it complete.',
  ];
  return {
    summary: lines.join('\n'),
    reviewMetrics: input.metrics.map((metric) => ({
      key: metric.key,
      name: metric.name,
      current: metric.current,
      baseline: metric.baseline,
      target: metric.target,
    })),
    findings: {
      goals: input.goals,
      plans: input.plans.map((plan) => ({
        id: plan.planId,
        title: plan.title,
        progressStatus: plan.progressStatus,
        reason: plan.reason,
      })),
      bottlenecks: input.bottlenecks.map((item) => item.title),
      opportunities: input.opportunities.map((item) => item.title),
      outcomes: input.outcomes,
      completedActions: input.completedActions,
      failedActions: input.failedActions,
    },
  };
}

export function assertReviewCompletable(status: string) {
  if (status === 'completed') throw new Error('This review is already complete.');
  if (status !== 'draft') throw new Error('Only a draft review can be completed.');
}

export function currentStage(input: {
  hasMetrics: boolean;
  hasFindings: boolean;
  hasRecommendations: boolean;
  hasActivePlan: boolean;
  hasPendingApproval: boolean;
  hasExecution: boolean;
  hasPendingMeasurement: boolean;
  hasEvaluation: boolean;
  hasCompletedReview: boolean;
}): CycleStage {
  if (input.hasCompletedReview) return 'IMPROVE';
  if (input.hasEvaluation) return 'EVALUATE';
  if (input.hasPendingMeasurement) return 'MEASURE';
  if (input.hasExecution) return 'EXECUTE';
  if (input.hasPendingApproval) return 'APPROVE';
  if (input.hasActivePlan) return 'PLAN';
  if (input.hasRecommendations) return 'RECOMMEND';
  if (input.hasFindings) return 'IDENTIFY';
  if (input.hasMetrics) return 'ANALYZE';
  return 'OBSERVE';
}

export function summarizeReview(deterministic: string, modelText: string | null) {
  if (!modelText || modelText.trim().length < 20) {
    return { summary: deterministic, source: 'deterministic' as const };
  }
  const numbers = modelText.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const value of numbers) {
    if (!deterministic.includes(value)) {
      return { summary: deterministic, source: 'deterministic' as const };
    }
  }
  if (/caused|guarantee|saved \$|revenue will/i.test(modelText)) {
    return { summary: deterministic, source: 'deterministic' as const };
  }
  return { summary: modelText.trim(), source: 'model' as const };
}

export function executionPolicy(actionType: string) {
  if (['email.send', 'sms.send', 'proposal.send', 'record.delete', 'company.delete'].includes(actionType)) {
    return { mode: 'approval_required' as const, autoExecute: false as const };
  }
  return { mode: 'manual_review' as const, autoExecute: false as const };
}

export function improvementJobId(tenantId: string, day: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('A tenant id is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('A day is required.');
  return `improvement-monitor:${tenantId}:${day}`;
}

export function queueFailureReport(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const duplicate = /already exists|duplicate job/i.test(message);
  return {
    duplicate,
    safeMessage: duplicate
      ? 'This tenant is already queued for today.'
      : 'The monitoring job could not be queued. Manual refresh does not need Redis.',
  };
}

export function sanitizeMetadata(input: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/prompt|secret|token|password|authorization|api[_-]?key/i.test(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 300);
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'boolean') safe[key] = value;
    else if (value === null) safe[key] = null;
  }
  return safe;
}

export function rejectForeignTenant(actorTenant: string, recordTenant: string) {
  if (actorTenant !== recordTenant) {
    throw new Error('The record is outside this tenant.');
  }
}

export function evidenceStillCurrent(key: string, currentKeys: string[]) {
  return currentKeys.includes(key);
}

export function periodKey(now: Date) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dayKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function deviation(
  metric: MetricObservation,
  deviationType: Deviation['deviationType'],
  baseline: number | null,
  deviationPercentage: number | null,
  trendDirection: Deviation['trendDirection'],
  detectedAt: string,
  thresholds: Thresholds,
  evidence: string[],
): Deviation {
  const base = baseline ?? metric.baseline;
  return {
    metricKey: metric.key,
    metricName: metric.name,
    deviationType,
    currentValue: metric.current,
    baselineValue: base,
    targetValue: metric.target,
    deviationValue: metric.current !== null && base !== null ? round(metric.current - base) : null,
    deviationPercentage,
    comparisonPeriod: metric.comparisonPeriod,
    trendDirection,
    evidence: evidence.filter((line) => line.trim().length > 0),
    confidenceLevel: confidenceFor(metric.sample, thresholds),
    detectedAt,
  };
}

function bottleneck(input: {
  code: string;
  periodKey: string;
  category: Bottleneck['category'];
  title: string;
  description: string;
  process: string;
  severity: Bottleneck['severity'];
  method: Bottleneck['detectionMethod'];
  investigation: string;
  confidence: Bottleneck['confidenceLevel'];
  evidence: string[];
  metrics: Record<string, number>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Bottleneck {
  return {
    fingerprint: `${input.category}:${input.code}:${input.periodKey}`,
    category: input.category,
    title: input.title,
    description: input.description,
    affectedProcess: input.process,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    severity: input.severity,
    detectionMethod: input.method,
    recommendedInvestigation: input.investigation,
    confidenceLevel: input.confidence,
    evidence: input.evidence,
    supportingMetrics: input.metrics,
  };
}

function opportunity(
  key: string,
  title: string,
  category: string,
  description: string,
  evidence: string[],
  affectedMetric: string,
  potentialBenefit: string,
  confidence: Opportunity['confidence'],
  suggestedImprovement: string,
): Opportunity {
  return {
    key,
    title,
    category,
    description,
    evidence,
    affectedMetric,
    potentialBenefit,
    expectedEffort: null,
    priority: confidence === 'HIGH' ? 'high' : 'medium',
    confidence,
    suggestedImprovement,
    reviewRequired: true,
  };
}

function recommendation(
  key: string,
  title: string,
  description: string,
  category: string,
  evidence: string[],
  reasoning: string,
  priority: number,
  confidence: RecommendationDraft['confidence'],
  expectedOutcome: string,
  relatedEntityId: string | null,
  relatedEntityType: string | null,
): RecommendationDraft {
  return {
    key: `improve:${key}`.slice(0, 120),
    title: title.slice(0, 200),
    description: description.slice(0, 800),
    category: 'improvement',
    evidence,
    reasoning: reasoning.slice(0, 800),
    priority,
    confidence,
    expectedOutcome: expectedOutcome.slice(0, 400),
    risks: 'Generating this recommendation does not change a plan, send a message, or execute an action. A person has to review it first.',
    suggestedImprovement: title.slice(0, 400),
    relatedEntityType,
    relatedEntityId,
    requiredPermission: 'analytics.view',
    approvalRequired: false,
  };
}

function isMaterial(current: number, baseline: number, metric: MetricObservation, thresholds: Thresholds) {
  const delta = Math.abs(current - baseline);
  if (metric.unit === 'rate') return delta >= thresholds.ratePoints;
  const ratio = percentChange(current, baseline);
  if (ratio.percent === null) return delta >= thresholds.minAbsolute;
  return Math.abs(ratio.percent) >= thresholds.deviationPercent && delta >= thresholds.minAbsolute;
}

function isReversal(metric: MetricObservation, thresholds: Thresholds) {
  if (metric.baseline === null || metric.previous === null || metric.current === null) return false;
  const improved = metric.direction === 'higher' ? metric.previous > metric.baseline : metric.previous < metric.baseline;
  const reversed = metric.direction === 'higher' ? metric.current < metric.previous : metric.current > metric.previous;
  return improved && reversed && isMaterial(metric.current, metric.previous, metric, thresholds);
}

function targetGap(metric: MetricObservation, thresholds: Thresholds) {
  if (metric.current === null || metric.target === null || metric.baseline === null) return false;
  const remaining = metric.direction === 'higher' ? metric.target - metric.current : metric.current - metric.target;
  const span = Math.abs(metric.target - metric.baseline);
  if (remaining <= 0 || span === 0) return false;
  return (remaining / span) * 100 >= thresholds.deviationPercent;
}

function meetsTarget(metric: MetricObservation) {
  if (metric.current === null || metric.target === null) return false;
  return metric.direction === 'higher' ? metric.current >= metric.target : metric.current <= metric.target;
}

function trendDirection(previous: number | null, current: number | null): Deviation['trendDirection'] {
  if (previous === null || current === null) return 'unknown';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function confidenceFor(sample: number, thresholds: Thresholds): Deviation['confidenceLevel'] {
  if (sample >= thresholds.minSample) return 'HIGH';
  if (sample >= 3) return 'MEDIUM';
  return 'LOW';
}

function assessment(
  plan: PlanObservation,
  progressStatus: ProgressStatus,
  executionProgress: number | null,
  outcomeProgress: number | null,
  reason: string,
): PlanAssessment {
  return {
    planId: plan.id,
    title: plan.title,
    storedStatus: plan.status,
    progressStatus,
    executionProgress,
    outcomeProgress,
    reason,
  };
}

function latestActivity(plan: PlanObservation) {
  const times = [new Date(plan.updatedAt).getTime()];
  for (const step of plan.steps) {
    if (step.completedAt) times.push(new Date(step.completedAt).getTime());
  }
  return new Date(Math.max(...times.filter((time) => Number.isFinite(time))));
}

function expectedFraction(createdAt: string, targetDate: string | null, now: Date) {
  if (!targetDate) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(targetDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

function formatValue(value: number | null) {
  if (value === null) return 'missing';
  return Number.isInteger(value) ? String(value) : String(round(value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function dedupeBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
  }
  return unique;
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
