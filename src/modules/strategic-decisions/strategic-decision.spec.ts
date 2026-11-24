import {
  actionStepsFor,
  assertPlanMove,
  buildRecommendations,
  discoverOpportunities,
  evidenceIsCurrent,
  executionKind,
  goalProgress,
  outcomeWording,
  priorityScore,
  rankSignals,
} from './strategic-decision';

const signal = {
  key: 'overdue_tasks',
  title: 'Several tasks are overdue now',
  description: 'Current overdue tasks.',
  severity: 'high' as const,
  confidence: 'HIGH',
  evidence: '6 open tasks have a due time before now.',
  action: 'Review the overdue task list.',
};

describe('strategic decision rules', () => {
  it('scores priority from impact, urgency, and confidence', () => {
    expect(priorityScore(5, 5, 'HIGH')).toBe(100);
    expect(priorityScore(4, 4, 'HIGH')).toBe(64);
    expect(priorityScore(4, 4, 'LOW')).toBe(26);
    expect(priorityScore(9, 9, 'HIGH')).toBe(100);
  });

  it('ranks known signals and ignores an unknown key', () => {
    const ranked = rankSignals([
      signal,
      {
        ...signal,
        key: 'pricing_gap',
        title: 'Missing prices',
        confidence: 'HIGH',
        severity: 'low',
      },
      { ...signal, key: 'made_up', title: 'Invented' },
    ]);
    expect(ranked.map((item) => item.key)).toEqual([
      'overdue_tasks',
      'pricing_gap',
    ]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].outcome).toContain('not described as an increase');
    expect(ranked.every((item) => item.approvalRequired === false)).toBe(true);
  });

  it('describes opportunities without a monetary benefit', () => {
    const items = discoverOpportunities({
      staleNewLeads: 4,
      expiringProposals: 2,
      leadsCreated: 3,
      previousLeads: 1,
      acceptanceRate: 80,
      previousAcceptanceRate: 40,
      acceptanceSample: 2,
      previousAcceptanceSample: 2,
      workflowFailures: 1,
    });
    expect(items.map((item) => item.key)).toEqual([
      'follow_up_stale_leads',
      'review_expiring_proposals',
    ]);
    expect(items.every((item) => item.effort === null)).toBe(true);
    expect(items.every((item) => item.limitation.includes('No monetary'))).toBe(
      true,
    );
  });

  it('keeps recommendation keys unique', () => {
    const priorities = rankSignals([signal]);
    const opportunities = discoverOpportunities({
      staleNewLeads: 0,
      expiringProposals: 0,
      leadsCreated: 12,
      previousLeads: 8,
      acceptanceRate: null,
      previousAcceptanceRate: null,
      acceptanceSample: 0,
      previousAcceptanceSample: 0,
      workflowFailures: 0,
    });
    const drafts = buildRecommendations(priorities, opportunities);
    const keys = drafts.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(drafts[0].reasoning).toContain('not a probability');
  });

  it('builds a review step and one internal task step', () => {
    const steps = actionStepsFor('Review stale leads');
    expect(steps.map((step) => step.actionType)).toEqual([
      'review',
      'create_task',
    ]);
    expect(steps[1].description).toContain('does not email');
  });

  it('blocks customer-facing actions and waits on an approval-gated task', () => {
    expect(executionKind('email.send', false)).toBe('blocked_sensitive');
    expect(executionKind('proposal.send', false)).toBe('blocked_sensitive');
    expect(executionKind('create_task', true)).toBe('await_approval');
    expect(executionKind('create_task', false)).toBe('create_task');
    expect(executionKind('review', false)).toBe('manual');
  });

  it('allows only the documented plan moves', () => {
    expect(() => assertPlanMove('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertPlanMove('ACTIVE', 'COMPLETED')).not.toThrow();
    expect(() => assertPlanMove('COMPLETED', 'ACTIVE')).toThrow(/cannot move/);
    expect(() => assertPlanMove('DRAFT', 'COMPLETED')).toThrow(/cannot move/);
  });

  it('withholds progress when the target equals the baseline and avoids division by zero', () => {
    expect(
      goalProgress({
        direction: 'lower',
        baseline: 10,
        current: 10,
        target: 10,
      }).progress,
    ).toBeNull();
    expect(
      goalProgress({ direction: 'lower', baseline: 10, current: 4, target: 0 })
        .progress,
    ).toBe(60);
    expect(
      goalProgress({
        direction: 'higher',
        baseline: 20,
        current: 50,
        target: 40,
      }).progress,
    ).toBe(100);
    expect(
      goalProgress({
        direction: 'higher',
        baseline: null,
        current: 1,
        target: 2,
      }).reason,
    ).toContain('missing');
  });

  it('does not claim a metric change was caused by an action', () => {
    const text = outcomeWording(10, 4, 'Overdue tasks');
    expect(text).toContain('does not show that an action caused the change');
  });

  it('rejects stale or expired evidence', () => {
    const now = new Date('2026-11-24T00:00:00Z');
    expect(
      evidenceIsCurrent(
        'overdue_tasks',
        ['overdue_tasks'],
        new Date('2026-11-25T00:00:00Z'),
        now,
      ),
    ).toBe(true);
    expect(
      evidenceIsCurrent(
        'overdue_tasks',
        [],
        new Date('2026-11-25T00:00:00Z'),
        now,
      ),
    ).toBe(false);
    expect(
      evidenceIsCurrent('overdue_tasks', ['overdue_tasks'], now, now),
    ).toBe(false);
  });
});
