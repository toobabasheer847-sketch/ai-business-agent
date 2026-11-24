import { BadRequestException } from '@nestjs/common';

import { isBusinessIntelligenceQuestion } from '../../ai/agents/master/orchestrator/intent-plan';
import {
  acceptanceRate,
  businessRisks,
  conversionReport,
  fillWeeks,
  forecastWeekly,
  insightsFrom,
  parseBusinessQuery,
  percentageError,
  pipelineForecast,
  workloadSummary,
} from './business-intelligence';

const steady = Array.from({ length: 12 }, (_, index) => ({
  week: `2026-01-${String(index + 1).padStart(2, '0')}`,
  value: 4,
}));

describe('business intelligence formulas', () => {
  it('forecasts a steady weekly series with a moving average and a holdout', () => {
    const result = forecastWeekly({
      metric: 'lead_volume',
      weeks: steady,
      horizonDays: 7,
      integer: true,
    });
    expect(result.status).toBe('forecast');
    expect(result.method).toBe('weekly_moving_average');
    expect(result.predicted).toBe(4);
    expect(result.lower).toBe(4);
    expect(result.upper).toBe(4);
    expect(result.confidence).toBe('HIGH');
    expect(result.holdout).toEqual({
      predicted: 4,
      actual: 4,
      absoluteError: 0,
      percentageError: 0,
    });
  });

  it('returns insufficient data and no false precision below the sample floor', () => {
    const result = forecastWeekly({
      metric: 'proposal_volume',
      weeks: [
        { week: '2026-01-05', value: 1 },
        { week: '2026-01-12', value: 1 },
        { week: '2026-01-19', value: 1 },
      ],
      horizonDays: 7,
      integer: true,
    });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.predicted).toBeNull();
    expect(result.confidence).toBe('INSUFFICIENT_DATA');
  });

  it('keeps the forecast range at or above zero', () => {
    const result = forecastWeekly({
      metric: 'accepted_count',
      weeks: [
        { week: 'a', value: 0 },
        { week: 'b', value: 10 },
        { week: 'c', value: 0 },
        { week: 'd', value: 10 },
      ],
      horizonDays: 7,
      integer: true,
    });
    expect(result.lower).toBe(0);
    expect(result.upper).toBeGreaterThanOrEqual(result.predicted ?? 0);
  });

  it('withholds a conversion rate and individual probabilities when outcomes are scarce', () => {
    const report = conversionReport({
      created: 4,
      converted: 1,
      lost: 1,
      open: 2,
      withTask: { converted: 1, lost: 0 },
      withoutTask: { converted: 0, lost: 1 },
    });
    expect(report.conversionRate).toBeNull();
    expect(report.individualProbabilities).toBe(false);
    expect(report.pattern).toBeNull();
    expect(report.explanation).toContain('fewer than 5');
  });

  it('reports a conversion pattern only as a correlation with counts', () => {
    const report = conversionReport({
      created: 20,
      converted: 8,
      lost: 4,
      open: 8,
      withTask: { converted: 5, lost: 1 },
      withoutTask: { converted: 3, lost: 3 },
    });
    expect(report.conversionRate).toBe(66.7);
    expect(report.pattern?.note).toContain('does not show that a task caused');
    expect(report.pattern?.withTaskRate).toBeGreaterThan(
      report.pattern?.withoutTaskRate ?? 100,
    );
  });

  it('keeps currencies separate and does not treat pending value as a forecast without history', () => {
    const rows = pipelineForecast({
      buckets: [
        {
          currency: 'USD',
          accepted: '100.00',
          pending: '50.00',
          rejected: '10.00',
          acceptedCount: 1,
          pendingCount: 1,
          rejectedCount: 1,
          missingPrice: 0,
        },
        {
          currency: 'EUR',
          accepted: '80.00',
          pending: '20.00',
          rejected: '0.00',
          acceptedCount: 1,
          pendingCount: 1,
          rejectedCount: 0,
          missingPrice: 2,
        },
      ],
      acceptanceRate: null,
      acceptanceSample: 2,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].forecastStatus).toBe('INSUFFICIENT_DATA');
    expect(rows[0].forecastPotential).toBeNull();
    expect(rows[1].currency).toBe('EUR');
  });

  it('estimates potential pipeline value from the historical acceptance rate', () => {
    const [row] = pipelineForecast({
      buckets: [
        {
          currency: 'USD',
          accepted: '100.00',
          pending: '200.00',
          rejected: '0.00',
          acceptedCount: 8,
          pendingCount: 2,
          rejectedCount: 0,
          missingPrice: 0,
        },
      ],
      acceptanceRate: 50,
      acceptanceSample: 8,
    });
    expect(row.forecastPotential).toBe(100);
    expect(row.label).toContain('not recognized revenue');
  });

  it('requires eight decided proposals before publishing an acceptance rate', () => {
    expect(acceptanceRate(2, 1, 0).rate).toBeNull();
    expect(acceptanceRate(8, 2, 0).rate).toBe(80);
  });

  it('detects supported risks and refuses an overdue increase claim', () => {
    const risks = businessRisks({
      staleNewLeads: 3,
      expiringProposals: 1,
      oldPendingProposals: 0,
      currentAcceptance: 40,
      previousAcceptance: 70,
      currentDecided: 10,
      previousDecided: 10,
      overdueTasks: 6,
      workflowFailures: 3,
      workflowTerminal: 5,
      openExceptions: 4,
      failedAgentRuns: 3,
      unpricedAgentRuns: 1,
    });
    expect(risks.map((risk) => risk.key)).toEqual(
      expect.arrayContaining([
        'stale_leads',
        'expiring_proposals',
        'acceptance_drop',
        'overdue_tasks',
        'workflow_failures',
        'open_exceptions',
        'agent_failures',
        'pricing_gap',
      ]),
    );
    expect(
      risks.find((risk) => risk.key === 'overdue_tasks')?.comparison,
    ).toContain('not described as an increase');
    expect(
      risks.find((risk) => risk.key === 'expiring_proposals')?.predictive,
    ).toBe(true);
  });

  it('does not raise a risk from a small sample', () => {
    expect(
      businessRisks({
        staleNewLeads: 1,
        expiringProposals: 0,
        oldPendingProposals: 1,
        currentAcceptance: 10,
        previousAcceptance: 90,
        currentDecided: 2,
        previousDecided: 2,
        overdueTasks: 1,
        workflowFailures: 1,
        workflowTerminal: 1,
        openExceptions: 1,
        failedAgentRuns: 1,
        unpricedAgentRuns: 0,
      }),
    ).toEqual([]);
  });

  it('builds unique suggestions from the same facts', () => {
    const risks = businessRisks({
      staleNewLeads: 0,
      expiringProposals: 0,
      oldPendingProposals: 0,
      currentAcceptance: 40,
      previousAcceptance: 70,
      currentDecided: 10,
      previousDecided: 10,
      overdueTasks: 0,
      workflowFailures: 4,
      workflowTerminal: 6,
      openExceptions: 3,
      failedAgentRuns: 0,
      unpricedAgentRuns: 0,
    });
    const insights = insightsFrom({
      leadsCreated: 4,
      previousLeads: 12,
      acceptance: 40,
      previousAcceptance: 70,
      pendingValueLabel: 'USD 500.00 across 2 sent or viewed proposals',
      overdueTasks: 1,
      dueNext7Days: 6,
      workflowFailures: 4,
      openExceptions: 3,
      risks,
    });
    const keys = insights.map((insight) => insight.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(insights.every((insight) => insight.suggestion)).toBe(true);
    expect(
      insights.find((insight) => insight.key === 'lead_decline')?.evidence,
    ).toContain('4');
  });

  it('describes workload without rating a person', () => {
    const summary = workloadSummary({
      open: 8,
      overdue: 2,
      dueNext7Days: 3,
      users: [{ userId: 'u1', name: 'Ada', open: 6, overdue: 1 }],
      completionSample: 2,
      averageCompletionMs: 1000,
    });
    expect(summary.note).toContain('not productivity');
    expect(summary.completionForecast).toBe('INSUFFICIENT_DATA');
    expect(summary.busiest?.name).toBe('Ada');
  });

  it('rejects an unbounded horizon and a lifetime window', () => {
    expect(() => parseBusinessQuery({ range: '30d', horizon: '90' })).toThrow(
      BadRequestException,
    );
    expect(() => parseBusinessQuery({ range: 'lifetime' })).toThrow(
      BadRequestException,
    );
    const parsed = parseBusinessQuery(
      { range: 'custom', from: '2026-01-01', to: '2026-01-31', horizon: '14' },
      new Date('2026-02-01T00:00:00Z'),
    );
    expect(parsed.horizon).toBe(14);
  });

  it('leaves percentage error blank when the actual value is zero', () => {
    expect(percentageError(4, 0)).toBeNull();
    expect(percentageError(12, 10)).toBe(20);
  });

  it('refuses a forecast when most weekly buckets are empty', () => {
    const result = forecastWeekly({
      metric: 'lead_volume',
      weeks: [
        { week: 'a', value: 10 },
        { week: 'b', value: 0 },
        { week: 'c', value: 0 },
        { week: 'd', value: 10 },
        { week: 'e', value: 0 },
        { week: 'f', value: 0 },
      ],
      horizonDays: 7,
      integer: true,
    });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.warnings.join(' ')).toContain('zero');
  });

  it('fills missing weeks with zero and keeps the span bounded', () => {
    const weeks = fillWeeks(
      [{ week: '2026-01-05T00:00:00.000Z', value: 3 }],
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-20T00:00:00Z'),
    );
    expect(weeks.length).toBeGreaterThan(1);
    expect(weeks.some((week) => week.value === 0)).toBe(true);
  });

  it('routes business questions to the intelligence action', () => {
    expect(
      isBusinessIntelligenceQuestion('What are the biggest risks this month?'),
    ).toBe(true);
    expect(
      isBusinessIntelligenceQuestion('How is our proposal pipeline looking?'),
    ).toBe(true);
    expect(
      isBusinessIntelligenceQuestion('What should I focus on this week?'),
    ).toBe(true);
    expect(
      isBusinessIntelligenceQuestion('Create a company called Northwind'),
    ).toBe(false);
  });
});
