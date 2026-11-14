import { buildInsights, narrativeUsesOnlyEvidence } from './analytics-insights';
import type { AnalyticsComparison, AnalyticsRate } from './analytics-range';

function comparison(current: number, previous: number): AnalyticsComparison {
  const difference = current - previous;
  return {
    current,
    previous,
    difference,
    percentChange: previous === 0 ? null : Math.round(((difference / previous) * 100) * 10) / 10,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
  };
}

const rate = (numerator: number, denominator: number): AnalyticsRate => ({
  numerator,
  denominator,
  percent: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
  definition: 'test',
});

describe('analytics insights', () => {
  const base = {
    evidencePeriod: '2026-10-15T12:00:00.000Z to 2026-11-14T12:00:00.000Z UTC',
    hasComparison: true,
    leads: comparison(0, 0),
    acceptedProposals: comparison(0, 0),
    overdueTasks: comparison(0, 0),
    leadConversion: rate(0, 0),
    acceptance: rate(0, 0),
    busiestMember: null,
  };

  it('reports a lead increase and an acceptance decrease from the calculated values', () => {
    const insights = buildInsights({
      ...base,
      leads: comparison(8, 4),
      acceptedProposals: comparison(1, 3),
      overdueTasks: comparison(5, 2),
      leadConversion: rate(1, 8),
    });
    expect(insights.map((item) => item.insightId)).toEqual([
      'leads-up',
      'acceptance-down',
      'overdue-up',
      'leads-early',
    ]);
    expect(insights[0].currentValue).toBe(8);
    expect(insights[0].previousValue).toBe(4);
    expect(JSON.stringify(insights)).not.toMatch(/Infinity|NaN/);
  });

  it('does not invent a trend when comparison is unavailable', () => {
    const insights = buildInsights({ ...base, hasComparison: false });
    expect(insights).toHaveLength(1);
    expect(insights[0].insightId).toBe('period-required');
  });

  it('rejects a narrative that introduces a number outside the evidence', () => {
    expect(narrativeUsesOnlyEvidence('Leads increased from 4 to 8.', [4, 8])).toBe(true);
    expect(narrativeUsesOnlyEvidence('Revenue reached 999.', [4, 8])).toBe(false);
  });

  it('calls out a higher open-task count without claiming hours of capacity', () => {
    const insights = buildInsights({
      ...base,
      busiestMember: { name: 'Sarah', openTasks: 6, nextOpenTasks: 2 },
    });
    const workload = insights.find((item) => item.insightId === 'workload-gap');
    expect(workload?.description).toContain('not available capacity');
    expect(workload?.currentValue).toBe(6);
  });
});
