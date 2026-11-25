import { readFileSync } from 'fs';
import { join } from 'path';

import { detectIntents } from '../../ai/agents/master/orchestrator/intent-plan';
import { hasPermission, Permission } from '../authorization/permissions';
import { assertPlanMove } from '../strategic-decisions/strategic-decision';
import {
  assertReviewCompletable,
  buildImprovementRecommendations,
  buildReview,
  currentStage,
  DEFAULT_THRESHOLDS,
  detectBottlenecks,
  detectDeviations,
  discoverImprovementOpportunities,
  evaluateActionOutcome,
  executionPolicy,
  improvementJobId,
  monitorPlan,
  percentChange,
  queueFailureReport,
  rejectForeignTenant,
  sanitizeMetadata,
  summarizeReview,
  windowsOverlap,
  type ActionObservation,
  type BottleneckSignals,
  type MetricObservation,
  type PlanObservation,
} from './continuous-improvement';

const now = new Date('2026-11-25T00:00:00.000Z');

function metric(partial: Partial<MetricObservation> & Pick<MetricObservation, 'key'>): MetricObservation {
  return {
    name: partial.key,
    unit: 'count',
    direction: 'lower',
    current: 10,
    baseline: 4,
    previous: 4,
    target: null,
    expected: null,
    sample: 12,
    currency: null,
    expectedCurrency: null,
    comparisonPeriod: 'previous_30d',
    evidence: 'Stored count.',
    ...partial,
  };
}

function plan(partial: Partial<PlanObservation> = {}): PlanObservation {
  return {
    id: 'plan-1',
    title: 'Reduce overdue work',
    status: 'ACTIVE',
    planKind: 'improvement',
    targetDate: '2026-12-25T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    metricKey: 'overdue_task_count',
    direction: 'lower',
    baseline: 20,
    current: 12,
    target: 4,
    milestones: [{ id: 'm1', title: 'Review the list', status: 'pending', dueDate: '2026-12-01T00:00:00.000Z' }],
    steps: [],
    ...partial,
  };
}

const quietSignals: BottleneckSignals = {
  inactiveLeads: 0,
  staleProspects: 0,
  oldPendingProposals: 0,
  overdueTasks: 0,
  openTasks: 0,
  overdueShare: null,
  openExceptions: 0,
  repeatedExceptions: [],
  workflowFailures: 0,
  failedSteps: 0,
  approvalDelays: 0,
  providerFailures: 0,
  retryingExecutions: 0,
  incompleteMilestonePlans: 0,
  goalsWithoutProgress: 0,
  blockedSteps: 0,
  plansWaitingApproval: 0,
};

describe('continuous improvement rules', () => {
  it('withholds a percentage when the baseline is zero or missing', () => {
    expect(percentChange(5, 0).percent).toBeNull();
    expect(percentChange(5, 0).reason).toContain('zero');
    expect(percentChange(null, 4).percent).toBeNull();
    expect(percentChange(12, 8).percent).toBe(50);
  });

  it('does not alert on a small rate sample or an insignificant count change', () => {
    const skipped = detectDeviations(
      [metric({ key: 'proposal_acceptance_rate', unit: 'rate', direction: 'higher', current: 80, baseline: 40, previous: 40, sample: 2 })],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(skipped).toEqual([]);
    const small = detectDeviations(
      [metric({ key: 'leads_created', direction: 'higher', current: 10, baseline: 10, previous: 10, target: null })],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(small).toEqual([]);
  });

  it('records a negative count deviation without calling it significant', () => {
    const [item] = detectDeviations(
      [metric({ key: 'overdue_task_count', name: 'Overdue tasks', current: 20, baseline: 8, previous: 8 })],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(item.deviationType).toBe('NEGATIVE');
    expect(item.deviationPercentage).not.toBeNull();
    expect(item.evidence.join(' ')).toContain('does not claim statistical significance');
    expect(item.confidenceLevel).toBe('HIGH');
  });

  it('reports a zero-baseline change without a percentage', () => {
    const [item] = detectDeviations(
      [metric({ key: 'workflow_failure_count', current: 4, baseline: 0, previous: 0, sample: 4 })],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(item.deviationPercentage).toBeNull();
    expect(item.evidence.join(' ')).toContain('baseline is zero');
  });

  it('does not compare different currencies and skips a missing current value', () => {
    const rows = detectDeviations(
      [
        metric({ key: 'accepted_value', current: 10, baseline: 4, currency: 'USD', expected: 2, expectedCurrency: 'EUR' }),
        metric({ key: 'missing', current: null, baseline: 4 }),
      ],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(rows.find((item) => item.metricKey === 'accepted_value' && item.deviationType === 'UNEXPECTED')).toBeUndefined();
    expect(rows.find((item) => item.metricKey === 'missing')).toBeUndefined();
  });

  it('detects a target gap, stagnation, and a reversal without a significance claim', () => {
    const rows = detectDeviations(
      [
        metric({ key: 'goal:1', name: 'Fewer overdue tasks', current: 18, baseline: 20, previous: 18, target: 4, direction: 'lower' }),
        metric({ key: 'goal:2', name: 'Acceptance', unit: 'rate', direction: 'higher', current: 40, baseline: 70, previous: 80, target: 80, sample: 10 }),
      ],
      DEFAULT_THRESHOLDS,
      now.toISOString(),
    );
    expect(rows.map((item) => `${item.metricKey}:${item.deviationType}`)).toEqual(
      expect.arrayContaining(['goal:1:STAGNATION', 'goal:1:TARGET_GAP', 'goal:2:TREND_REVERSAL']),
    );
    expect(rows.find((item) => item.deviationType === 'TREND_REVERSAL')?.evidence.join(' ')).toContain('not a statistical significance test');
  });

  it('marks a quiet active plan stalled and an overdue milestone overdue', () => {
    const stalled = monitorPlan(
      plan({ updatedAt: '2026-10-01T00:00:00.000Z', milestones: [{ id: 'm1', title: 'Review', status: 'pending', dueDate: '2026-12-01T00:00:00.000Z' }] }),
      now,
      DEFAULT_THRESHOLDS,
    );
    expect(stalled.progressStatus).toBe('stalled');
    expect(stalled.reason).toContain('14 days');
    const overdue = monitorPlan(
      plan({ milestones: [{ id: 'm1', title: 'Review', status: 'pending', dueDate: '2026-11-01T00:00:00.000Z' }] }),
      now,
      DEFAULT_THRESHOLDS,
    );
    expect(overdue.progressStatus).toBe('overdue');
    expect(overdue.storedStatus).toBe('ACTIVE');
  });

  it('does not treat completed work items as the business outcome', () => {
    const assessed = monitorPlan(
      plan({
        status: 'COMPLETED',
        milestones: [{ id: 'm1', title: 'Review', status: 'completed', dueDate: null }],
        current: 20,
        baseline: 20,
        target: 4,
      }),
      now,
      DEFAULT_THRESHOLDS,
    );
    expect(assessed.progressStatus).toBe('completed');
    expect(assessed.executionProgress).toBe(100);
    expect(assessed.reason).toContain('not treated as proof');
    expect(assessed.outcomeProgress).toBe(0);
  });

  it('returns insufficient data when a plan has no work items and no metric', () => {
    const assessed = monitorPlan(
      plan({ milestones: [], steps: [], baseline: null, current: null, target: null, direction: null }),
      now,
      DEFAULT_THRESHOLDS,
    );
    expect(assessed.progressStatus).toBe('insufficient_data');
    expect(assessed.reason).toContain('plan description');
  });

  it('keeps one bottleneck per fingerprint and does not name a person', () => {
    const found = detectBottlenecks(
      { ...quietSignals, overdueTasks: 8, overdueShare: 0.75, repeatedExceptions: [{ id: 'ex-1', title: 'Mail failure', count: 4 }] },
      DEFAULT_THRESHOLDS,
      '2026-11',
    );
    const keys = found.map((item) => item.fingerprint);
    expect(new Set(keys).size).toBe(keys.length);
    expect(found.find((item) => item.fingerprint.includes('concentrated'))?.description).not.toMatch(/employee|user id/i);
    expect(found.find((item) => item.fingerprint.includes('repeated'))?.recommendedInvestigation).toContain('Do not open a second exception');
    expect(found.every((item) => item.recommendedInvestigation.toLowerCase().includes('not') || item.evidence.join(' ').length > 0)).toBe(true);
  });

  it('describes opportunities without a calculated saving', () => {
    const items = discoverImprovementOpportunities({
      workflowFailures: 4,
      overdueTasks: 9,
      previousOverdueTasks: 4,
      oldPendingProposals: 3,
      goalsBehindTarget: 1,
      repeatedExceptions: 1,
    });
    expect(items.every((item) => item.expectedEffort === null)).toBe(true);
    expect(items.every((item) => item.potentialBenefit.toLowerCase().includes('no '))).toBe(true);
    expect(items.map((item) => item.key)).toEqual([
      'workflow_configuration',
      'task_deadlines',
      'proposal_follow_up',
      'goal_strategy',
      'recurring_exception',
    ]);
  });

  it('dedupes recommendations and never marks them for automatic execution', () => {
    const drafts = buildImprovementRecommendations({
      plans: [
        {
          planId: 'plan-1',
          title: 'Reduce overdue work',
          storedStatus: 'ACTIVE',
          progressStatus: 'overdue',
          executionProgress: 0,
          outcomeProgress: null,
          reason: 'A milestone due date has passed.',
        },
      ],
      deviations: [],
      bottlenecks: detectBottlenecks({ ...quietSignals, workflowFailures: 4 }, DEFAULT_THRESHOLDS, '2026-11'),
      opportunities: discoverImprovementOpportunities({
        workflowFailures: 4,
        overdueTasks: 0,
        previousOverdueTasks: null,
        oldPendingProposals: 0,
        goalsBehindTarget: 0,
        repeatedExceptions: 0,
      }),
    });
    const keys = drafts.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(drafts.every((item) => item.approvalRequired === false)).toBe(true);
    expect(drafts.every((item) => item.requiredPermission === 'analytics.view')).toBe(true);
    expect(drafts.every((item) => item.risks.includes('does not change a plan'))).toBe(true);
  });

  it('evaluates outcomes without a causal claim', () => {
    const completed: ActionObservation = {
      actionPlanId: 'action-1',
      title: 'Follow up overdue tasks',
      status: 'completed',
      metricKey: 'overdue_task_count',
      goalId: 'goal-1',
      direction: 'lower',
      baseline: 24,
      measured: 17,
      completedAt: '2026-10-01T00:00:00.000Z',
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-10-29T00:00:00.000Z',
      overlapping: false,
    };
    const positive = evaluateActionOutcome(completed, now, DEFAULT_THRESHOLDS);
    expect(positive.status).toBe('POSITIVE_OBSERVED_CHANGE');
    expect(positive.statement).toContain('does not show that an action caused');
    expect(positive.statement).toContain('24');
    expect(positive.statement).toContain('17');
    expect(evaluateActionOutcome({ ...completed, measured: null }, now, DEFAULT_THRESHOLDS).status).toBe('INSUFFICIENT_DATA');
    expect(evaluateActionOutcome({ ...completed, overlapping: true }, now, DEFAULT_THRESHOLDS).status).toBe('INCONCLUSIVE');
    expect(evaluateActionOutcome({ ...completed, periodEnd: '2026-12-25T00:00:00.000Z' }, now, DEFAULT_THRESHOLDS).status).toBe('PENDING_MEASUREMENT');
    expect(evaluateActionOutcome({ ...completed, status: 'ready' }, now, DEFAULT_THRESHOLDS).status).toBe('NOT_EVALUATED');
    expect(
      windowsOverlap(
        { start: '2026-10-01T00:00:00.000Z', end: '2026-10-29T00:00:00.000Z', metricKey: 'overdue_task_count' },
        { start: '2026-10-10T00:00:00.000Z', end: '2026-11-07T00:00:00.000Z', metricKey: 'overdue_task_count' },
      ),
    ).toBe(true);
  });

  it('builds a review from supplied figures and completes it only on request', () => {
    const review = buildReview({
      periodStart: '2026-10-26T00:00:00.000Z',
      periodEnd: '2026-11-25T00:00:00.000Z',
      metrics: [metric({ key: 'overdue_task_count', name: 'Overdue tasks', current: 8, baseline: 12 })],
      goals: [{ name: 'Fewer overdue tasks', progress: 40, note: '40% of the way from the baseline to the target.' }],
      plans: [
        {
          planId: 'plan-1',
          title: 'Reduce overdue work',
          storedStatus: 'ACTIVE',
          progressStatus: 'on_track',
          executionProgress: 50,
          outcomeProgress: 40,
          reason: 'Stored work is inside the schedule.',
        },
      ],
      completedActions: 1,
      failedActions: 0,
      bottlenecks: [],
      opportunities: [],
      outcomes: [],
    });
    expect(review.summary).toContain('Overdue tasks');
    expect(review.summary).toContain('only after a person marks it complete');
    expect(review.reviewMetrics[0].current).toBe(8);
    expect(() => assertReviewCompletable('completed')).toThrow(/already complete/);
    expect(() => assertReviewCompletable('draft')).not.toThrow();
  });

  it('moves through the improvement cycle from stored flags', () => {
    expect(currentStage({
      hasMetrics: false,
      hasFindings: false,
      hasRecommendations: false,
      hasActivePlan: false,
      hasPendingApproval: false,
      hasExecution: false,
      hasPendingMeasurement: false,
      hasEvaluation: false,
      hasCompletedReview: false,
    })).toBe('OBSERVE');
    expect(currentStage({
      hasMetrics: true,
      hasFindings: true,
      hasRecommendations: true,
      hasActivePlan: true,
      hasPendingApproval: false,
      hasExecution: true,
      hasPendingMeasurement: false,
      hasEvaluation: true,
      hasCompletedReview: true,
    })).toBe('IMPROVE');
  });

  it('falls back when a model adds a number or a cause', () => {
    const deterministic = 'Overdue tasks were 24 and then 17.';
    expect(summarizeReview(deterministic, null).source).toBe('deterministic');
    expect(summarizeReview(deterministic, 'Overdue tasks were 24 and then 17. This does not show a cause.').source).toBe('model');
    expect(summarizeReview(deterministic, 'Overdue tasks fell to 3 because the plan worked.').source).toBe('deterministic');
    expect(summarizeReview(deterministic, 'The plan caused the drop from 24 to 17.').source).toBe('deterministic');
  });

  it('keeps sensitive execution behind approval and never auto-executes', () => {
    expect(executionPolicy('email.send')).toEqual({ mode: 'approval_required', autoExecute: false });
    expect(executionPolicy('proposal.send').autoExecute).toBe(false);
    expect(executionPolicy('review')).toEqual({ mode: 'manual_review', autoExecute: false });
    expect(executionPolicy('start_workflow').autoExecute).toBe(false);
  });

  it('dedupes the daily monitor job and hides queue internals', () => {
    expect(improvementJobId('11111111-1111-4111-8111-111111111111', '2026-11-25')).toBe(
      improvementJobId('11111111-1111-4111-8111-111111111111', '2026-11-25'),
    );
    const report = queueFailureReport(new Error('connect ECONNREFUSED redis://secret.example:6379'));
    expect(report.safeMessage).not.toContain('secret');
    expect(report.safeMessage).toContain('Manual refresh');
    expect(queueFailureReport(new Error('Job already exists')).duplicate).toBe(true);
  });

  it('rejects another tenant and strips secrets from history', () => {
    expect(() => rejectForeignTenant('tenant-a', 'tenant-b')).toThrow(/outside this tenant/);
    expect(rejectForeignTenant('tenant-a', 'tenant-a')).toBeUndefined();
    expect(sanitizeMetadata({ prompt: 'secret', apiKey: 'secret', status: 'open', note: 'Reviewed the count' })).toEqual({
      status: 'open',
      note: 'Reviewed the count',
    });
  });

  it('limits continuous improvement to analytics viewers', () => {
    expect(hasPermission('owner', Permission.AnalyticsView)).toBe(true);
    expect(hasPermission('admin', Permission.AnalyticsView)).toBe(true);
    expect(hasPermission('member', Permission.AnalyticsView)).toBe(false);
  });

  it('allows the existing draft activation and the new review path', () => {
    expect(() => assertPlanMove('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertPlanMove('DRAFT', 'REVIEW_REQUIRED')).not.toThrow();
    expect(() => assertPlanMove('REVIEW_REQUIRED', 'APPROVED')).not.toThrow();
    expect(() => assertPlanMove('APPROVED', 'ACTIVE')).not.toThrow();
    expect(() => assertPlanMove('ACTIVE', 'COMPLETED')).not.toThrow();
    expect(() => assertPlanMove('COMPLETED', 'ACTIVE')).toThrow(/cannot move/);
  });

  it('routes improvement questions to the existing assistant and does not create a plan', () => {
    const questions = [
      'Why are my business goals not progressing?',
      'Which business processes need improvement?',
      'What bottlenecks are affecting our operations?',
      'Which action plans have measurable results?',
      'What improvements should we prioritize this month?',
      'Review my active strategic plans.',
      'What changed since our last business review?',
      'Which recommendations were useful?',
      'What should we improve next?',
      'Create a plan to improve our task completion rate.',
    ];
    for (const question of questions) {
      expect(detectIntents(question).intents).toEqual(['improvement.review']);
    }
  });

  it('defines tenant-scoped tables and does not store prompts', () => {
    const sql = readFileSync(
      join(__dirname, '../../database/drizzle/migrations/0010_continuous_improvement.sql'),
      'utf8',
    );
    for (const table of [
      'business_performance_deviations',
      'business_bottlenecks',
      'improvement_outcome_evaluations',
      'business_improvement_reviews',
      'business_improvement_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    expect(sql).toContain('"tenant_id" uuid NOT NULL');
    expect(sql).not.toMatch(/prompt|password|api_key/i);
    expect(sql).toContain('strategic_plans_status_check');
    expect(sql).toContain('REFERENCES "tenants"("id")');
  });
});
