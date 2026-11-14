import type { AnalyticsComparison, AnalyticsRate } from './analytics-range.js';

export type AnalyticsInsight = {
  insightId: string;
  category: 'sales' | 'proposals' | 'tasks' | 'team' | 'communications' | 'general';
  title: string;
  description: string;
  supportingMetric: string;
  currentValue: number | null;
  previousValue: number | null;
  trend: AnalyticsComparison['direction'];
  severity: 'info' | 'watch' | 'attention';
  recommendation: string;
  evidencePeriod: string;
  kind: 'fact' | 'recommendation';
};

export type InsightInput = {
  evidencePeriod: string;
  hasComparison: boolean;
  leads: AnalyticsComparison;
  acceptedProposals: AnalyticsComparison;
  overdueTasks: AnalyticsComparison;
  leadConversion: AnalyticsRate;
  acceptance: AnalyticsRate;
  busiestMember: { name: string; openTasks: number; nextOpenTasks: number | null } | null;
};

const ALLOWED_NUMBER = /-?\d+(?:\.\d+)?/g;

export function buildInsights(input: InsightInput): AnalyticsInsight[] {
  if (!input.hasComparison) {
    return [insight({
      insightId: 'period-required',
      category: 'general',
      title: 'A date range is required before trends can be compared',
      description: 'Lifetime totals are not mixed into a period trend. Choose 7, 30, or 90 days, or a custom range.',
      supportingMetric: 'period',
      currentValue: null,
      previousValue: null,
      trend: 'unavailable',
      severity: 'info',
      recommendation: 'Select a date range to compare the current period with the preceding period of the same length.',
      evidencePeriod: input.evidencePeriod,
      kind: 'fact',
    })];
  }

  const insights: AnalyticsInsight[] = [];
  if (input.leads.direction === 'up') {
    insights.push(changeInsight(input, 'leads-up', 'sales', 'Lead creation increased', 'leadsCreated', input.leads, 'info', 'Review the new leads and connect the ones that do not yet have a prospect.'));
  } else if (input.leads.direction === 'down' && input.leads.previous !== null && input.leads.previous > 0) {
    insights.push(changeInsight(input, 'leads-down', 'sales', 'Lead creation decreased', 'leadsCreated', input.leads, 'watch', 'Compare lead sources for the two periods. This does not estimate revenue.'));
  }

  if (input.acceptedProposals.direction === 'down' && (input.acceptedProposals.previous ?? 0) > 0) {
    insights.push(changeInsight(input, 'acceptance-down', 'proposals', 'Proposal acceptance decreased', 'proposalsAccepted', input.acceptedProposals, 'attention', 'Check proposals sent in this period. Acceptance uses acceptedAt, not draft counts.'));
  } else if (input.acceptedProposals.direction === 'up') {
    insights.push(changeInsight(input, 'acceptance-up', 'proposals', 'Proposal acceptance increased', 'proposalsAccepted', input.acceptedProposals, 'info', 'Keep the same sent-proposal follow-up that produced the accepted records.'));
  }

  if (input.overdueTasks.direction === 'up') {
    insights.push(changeInsight(input, 'overdue-up', 'tasks', 'Overdue tasks increased', 'overdueTasks', input.overdueTasks, 'attention', 'Review open tasks past their due time. Completed and cancelled tasks are not included.'));
  }

  if (
    input.leadConversion.percent !== null &&
    input.leadConversion.denominator >= 4 &&
    input.leadConversion.percent < 25
  ) {
    insights.push(insight({
      insightId: 'leads-early',
      category: 'sales',
      title: 'Most leads in this period have no prospect',
      description: `${input.leadConversion.numerator} of ${input.leadConversion.denominator} leads created in this period have a prospect (${input.leadConversion.percent}%). This uses the prospect leadId foreign key, not a guessed stage history.`,
      supportingMetric: 'leadToProspect',
      currentValue: input.leadConversion.percent,
      previousValue: null,
      trend: 'unavailable',
      severity: 'watch',
      recommendation: 'Qualify the leads that still have no prospect before treating them as pipeline progress.',
      evidencePeriod: input.evidencePeriod,
      kind: 'fact',
    }));
  }

  if (
    input.busiestMember &&
    input.busiestMember.openTasks >= 3 &&
    (input.busiestMember.nextOpenTasks === null || input.busiestMember.openTasks >= input.busiestMember.nextOpenTasks * 2)
  ) {
    insights.push(insight({
      insightId: 'workload-gap',
      category: 'team',
      title: `${input.busiestMember.name} has a higher open-task count`,
      description: `${input.busiestMember.name} has ${input.busiestMember.openTasks} open tasks (pending plus in progress). The next highest open count is ${input.busiestMember.nextOpenTasks ?? 0}. Working hours are not stored, so this is not available capacity or a productivity score.`,
      supportingMetric: 'openTasks',
      currentValue: input.busiestMember.openTasks,
      previousValue: input.busiestMember.nextOpenTasks,
      trend: 'unavailable',
      severity: 'watch',
      recommendation: 'Use open task counts when assigning new work. Do not treat the gap as hours of availability.',
      evidencePeriod: input.evidencePeriod,
      kind: 'recommendation',
    }));
  }

  if (!insights.length) {
    insights.push(insight({
      insightId: 'no-significant-change',
      category: 'general',
      title: 'No significant change in the compared metrics',
      description: 'Lead creation, accepted proposals, and overdue tasks did not move enough to call out. Empty or flat values are reported as-is.',
      supportingMetric: 'comparison',
      currentValue: input.leads.current,
      previousValue: input.leads.previous,
      trend: 'flat',
      severity: 'info',
      recommendation: 'Keep the selected range, or widen it if the tenant has little recent activity.',
      evidencePeriod: input.evidencePeriod,
      kind: 'fact',
    }));
  }

  return insights;
}

export function narrativeNumbers(text: string): number[] {
  return (text.match(ALLOWED_NUMBER) ?? []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

export function narrativeUsesOnlyEvidence(text: string, allowed: number[]): boolean {
  const evidence = new Set(allowed.map((value) => normalizeNumber(value)));
  return narrativeNumbers(text).every((value) => evidence.has(normalizeNumber(value)));
}

function changeInsight(
  input: InsightInput,
  insightId: string,
  category: AnalyticsInsight['category'],
  title: string,
  supportingMetric: string,
  comparison: AnalyticsComparison,
  severity: AnalyticsInsight['severity'],
  recommendation: string,
): AnalyticsInsight {
  const percent = comparison.percentChange === null ? 'percent unavailable because the previous value is 0' : `${comparison.percentChange}%`;
  return insight({
    insightId,
    category,
    title,
    description: `${title}: ${comparison.current} in the current period and ${comparison.previous} in the previous period (${percent}).`,
    supportingMetric,
    currentValue: comparison.current,
    previousValue: comparison.previous,
    trend: comparison.direction,
    severity,
    recommendation,
    evidencePeriod: input.evidencePeriod,
    kind: 'fact',
  });
}

function insight(value: AnalyticsInsight): AnalyticsInsight {
  return value;
}

function normalizeNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}
