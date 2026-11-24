import { BadRequestException } from '@nestjs/common';

import {
  startOfUtcDay,
  startOfUtcWeek,
} from '../../ai/agents/task/parse-task-datetime';
import { resolveDashboardWindow } from '../dashboard/dashboard-range';

export const MIN_WEEKS = 4;
export const MIN_OBSERVATIONS = 8;
export const MIN_TERMINAL_LEADS = 5;
export const MIN_PATTERN_GROUP = 5;
export const MIN_ACCEPTANCE_SAMPLE = 8;
export const MAX_HORIZON_DAYS = 30;
export const MAX_LOOKBACK_DAYS = 366;

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export type ForecastResult = {
  metric: string;
  status: 'forecast' | 'INSUFFICIENT_DATA';
  method: 'weekly_moving_average' | null;
  horizonDays: number;
  predicted: number | null;
  lower: number | null;
  upper: number | null;
  confidence: Confidence;
  weeks: number;
  observations: number;
  warnings: string[];
  holdout: {
    predicted: number;
    actual: number;
    absoluteError: number;
    percentageError: number | null;
  } | null;
};

export type WeeklyPoint = { week: string; value: number };

export function forecastWeekly(input: {
  metric: string;
  weeks: WeeklyPoint[];
  horizonDays: number;
  integer: boolean;
}): ForecastResult {
  const horizonDays = clamp(Math.round(input.horizonDays), 1, MAX_HORIZON_DAYS);
  const observations = input.weeks.reduce((sum, week) => sum + week.value, 0);
  const base = {
    metric: input.metric,
    method: 'weekly_moving_average' as const,
    horizonDays,
    weeks: input.weeks.length,
    observations,
    warnings: emptyWeekWarning(input.weeks),
  };
  if (
    input.weeks.length < MIN_WEEKS ||
    observations < MIN_OBSERVATIONS ||
    base.warnings.length > 0
  ) {
    return {
      ...base,
      status: 'INSUFFICIENT_DATA',
      method: null,
      predicted: null,
      lower: null,
      upper: null,
      confidence: 'INSUFFICIENT_DATA',
      holdout: null,
      warnings: [
        ...base.warnings,
        `A forecast needs at least ${MIN_WEEKS} active weeks and ${MIN_OBSERVATIONS} observations, without a majority of empty weeks.`,
      ],
    };
  }
  const mean = average(input.weeks.map((week) => week.value));
  const spread = standardDeviation(input.weeks.map((week) => week.value));
  const scale = horizonDays / 7;
  const predicted = roundValue(mean * scale, input.integer);
  const lower = roundValue(Math.max(0, (mean - spread) * scale), input.integer);
  const upper = roundValue(
    Math.max(predicted, (mean + spread) * scale),
    input.integer,
  );
  const holdout = holdoutError(input.weeks, input.integer);
  return {
    ...base,
    status: 'forecast',
    predicted,
    lower,
    upper,
    confidence: confidenceFor(input.weeks.length, mean, spread),
    holdout,
  };
}

export function conversionReport(input: {
  created: number;
  converted: number;
  lost: number;
  open: number;
  withTask: { converted: number; lost: number };
  withoutTask: { converted: number; lost: number };
}) {
  const terminal = input.converted + input.lost;
  const rate =
    terminal >= MIN_TERMINAL_LEADS
      ? round1((input.converted / terminal) * 100)
      : null;
  const withTerminal = input.withTask.converted + input.withTask.lost;
  const withoutTerminal = input.withoutTask.converted + input.withoutTask.lost;
  const pattern =
    withTerminal >= MIN_PATTERN_GROUP && withoutTerminal >= MIN_PATTERN_GROUP
      ? {
          withTaskRate: round1((input.withTask.converted / withTerminal) * 100),
          withoutTaskRate: round1(
            (input.withoutTask.converted / withoutTerminal) * 100,
          ),
          note: 'This compares historical outcomes. It does not show that a task caused the conversion.',
        }
      : null;
  return {
    created: input.created,
    converted: input.converted,
    lost: input.lost,
    open: input.open,
    terminal,
    conversionRate: rate,
    individualProbabilities: false as const,
    pattern,
    explanation:
      rate === null
        ? `Conversion rate is unavailable because fewer than ${MIN_TERMINAL_LEADS} leads have a converted or lost status.`
        : `${input.converted} of ${terminal} leads created in this period now have a converted or lost status and are converted.`,
  };
}

export type MoneyBucket = {
  currency: string;
  accepted: string;
  pending: string;
  rejected: string;
  acceptedCount: number;
  pendingCount: number;
  rejectedCount: number;
  missingPrice: number;
};

export function pipelineForecast(input: {
  buckets: MoneyBucket[];
  acceptanceRate: number | null;
  acceptanceSample: number;
}) {
  return input.buckets.map((bucket) => {
    const supported =
      input.acceptanceSample >= MIN_ACCEPTANCE_SAMPLE &&
      input.acceptanceRate !== null &&
      bucket.pendingCount > 0;
    const pending = Number(bucket.pending);
    const forecast = supported
      ? roundMoney((pending * (input.acceptanceRate as number)) / 100)
      : null;
    return {
      ...bucket,
      label:
        'Accepted value is proposal value, not recognized revenue. Pending value is sent or viewed proposals only.',
      forecastPotential: forecast,
      forecastStatus: supported
        ? ('estimated' as const)
        : ('INSUFFICIENT_DATA' as const),
    };
  });
}

export function acceptanceRate(
  accepted: number,
  rejected: number,
  expired: number,
) {
  const decided = accepted + rejected + expired;
  if (decided < MIN_ACCEPTANCE_SAMPLE)
    return { decided, rate: null as number | null };
  return { decided, rate: round1((accepted / decided) * 100) };
}

export type RiskDraft = {
  key: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  evidence: string;
  comparison: string;
  action: string;
  confidence: Confidence;
  predictive: boolean;
};

export function businessRisks(input: {
  staleNewLeads: number;
  expiringProposals: number;
  oldPendingProposals: number;
  currentAcceptance: number | null;
  previousAcceptance: number | null;
  currentDecided: number;
  previousDecided: number;
  overdueTasks: number;
  workflowFailures: number;
  workflowTerminal: number;
  openExceptions: number;
  failedAgentRuns: number;
  unpricedAgentRuns: number;
}): RiskDraft[] {
  const risks: RiskDraft[] = [];
  if (input.staleNewLeads >= 3) {
    risks.push(
      risk(
        'stale_leads',
        'sales',
        'medium',
        'Leads are still new after seven days',
        `${input.staleNewLeads} leads created more than seven days ago are still new.`,
        'This is a current count, not a forecast.',
        'Record a follow-up or update the lead status.',
        'MEDIUM',
        false,
      ),
    );
  }
  if (input.expiringProposals >= 1) {
    risks.push(
      risk(
        'expiring_proposals',
        'sales',
        'high',
        'Proposals are near their validity date',
        `${input.expiringProposals} sent or viewed proposals expire within seven days.`,
        'Expiry uses the stored valid_until timestamp.',
        'Review those proposals before the date passes.',
        'HIGH',
        true,
      ),
    );
  }
  if (input.oldPendingProposals >= 3) {
    risks.push(
      risk(
        'old_pending_proposals',
        'sales',
        'medium',
        'Proposals have been pending for more than 14 days',
        `${input.oldPendingProposals} sent or viewed proposals were created more than 14 days ago and have no decision.`,
        'Pending means sent or viewed. Drafts are not included.',
        'Check whether those proposals still need a decision.',
        'MEDIUM',
        false,
      ),
    );
  }
  if (
    input.currentAcceptance !== null &&
    input.previousAcceptance !== null &&
    input.currentDecided >= MIN_ACCEPTANCE_SAMPLE &&
    input.previousDecided >= MIN_ACCEPTANCE_SAMPLE &&
    input.previousAcceptance - input.currentAcceptance >= 15
  ) {
    risks.push(
      risk(
        'acceptance_drop',
        'sales',
        'high',
        'Proposal acceptance is lower than the previous period',
        `Acceptance is ${input.currentAcceptance}% from ${input.currentDecided} decisions, compared with ${input.previousAcceptance}% from ${input.previousDecided} decisions.`,
        'Both periods have at least eight decisions. This is a comparison, not a cause.',
        'Review the proposals decided in this period.',
        'MEDIUM',
        false,
      ),
    );
  }
  if (input.overdueTasks >= 5) {
    risks.push(
      risk(
        'overdue_tasks',
        'operations',
        'high',
        'Several tasks are overdue now',
        `${input.overdueTasks} open tasks have a due time before now.`,
        'Past overdue counts are not stored, so this is not described as an increase.',
        'Review the overdue task list.',
        'HIGH',
        false,
      ),
    );
  }
  if (input.workflowTerminal >= 3 && input.workflowFailures >= 3) {
    risks.push(
      risk(
        'workflow_failures',
        'automation',
        'high',
        'Workflow executions are failing',
        `${input.workflowFailures} of ${input.workflowTerminal} finished workflow executions failed or only partly completed.`,
        'Retries stay inside the same execution.',
        'Open the workflow analytics failures list.',
        'MEDIUM',
        false,
      ),
    );
  }
  if (input.openExceptions >= 3) {
    risks.push(
      risk(
        'open_exceptions',
        'operations',
        'medium',
        'Operational exceptions are still open',
        `${input.openExceptions} exceptions are open, acknowledged, or in progress.`,
        'These are existing Exception Center records, not a second copy.',
        'Review the Exception Center.',
        'HIGH',
        false,
      ),
    );
  }
  if (input.failedAgentRuns >= 3) {
    risks.push(
      risk(
        'agent_failures',
        'automation',
        'medium',
        'AI provider runs are failing',
        `${input.failedAgentRuns} agent runs failed in this period.`,
        'The count comes from agent_runs.',
        'Check AI monitoring before relying on model features.',
        'MEDIUM',
        false,
      ),
    );
  }
  if (input.unpricedAgentRuns >= 1) {
    risks.push(
      risk(
        'pricing_gap',
        'automation',
        'low',
        'Some AI runs have no configured price',
        `${input.unpricedAgentRuns} runs are missing a price in AI_MODEL_PRICES.`,
        'No cost was invented for those runs.',
        'Add the provider and model price or leave the cost blank.',
        'HIGH',
        false,
      ),
    );
  }
  return risks;
}

export type InsightDraft = {
  key: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  evidence: string;
  confidence: Confidence;
  recommendation: string;
  suggestion: true;
};

export function insightsFrom(input: {
  leadsCreated: number;
  previousLeads: number;
  acceptance: number | null;
  previousAcceptance: number | null;
  pendingValueLabel: string | null;
  overdueTasks: number;
  dueNext7Days: number;
  workflowFailures: number;
  openExceptions: number;
  risks: RiskDraft[];
}): InsightDraft[] {
  const insights: InsightDraft[] = [];
  if (
    input.previousLeads >= MIN_OBSERVATIONS &&
    input.leadsCreated < input.previousLeads
  ) {
    insights.push(
      insight(
        'lead_decline',
        'sales',
        'medium',
        'Fewer leads were created than in the previous period',
        `${input.leadsCreated} leads were created, compared with ${input.previousLeads} in the previous period.`,
        'LOW',
        'Compare the lead sources for the two periods.',
      ),
    );
  }
  if (
    input.acceptance !== null &&
    input.previousAcceptance !== null &&
    input.previousAcceptance - input.acceptance >= 15
  ) {
    insights.push(
      insight(
        'acceptance_decline',
        'sales',
        'high',
        'Proposal acceptance is lower than the previous period',
        `Acceptance moved from ${input.previousAcceptance}% to ${input.acceptance}%.`,
        'MEDIUM',
        'Review the decided proposals before treating the change as a trend.',
      ),
    );
  }
  if (input.pendingValueLabel) {
    insights.push(
      insight(
        'pending_pipeline',
        'pipeline',
        'medium',
        'Pending proposal value is a pipeline estimate',
        input.pendingValueLabel,
        'MEDIUM',
        'Do not book this value as revenue.',
      ),
    );
  }
  if (input.dueNext7Days >= 5) {
    insights.push(
      insight(
        'deadline_cluster',
        'operations',
        'medium',
        'Task deadlines are concentrated in the next seven days',
        `${input.dueNext7Days} open tasks are due within seven days. ${input.overdueTasks} open tasks are already overdue.`,
        'HIGH',
        'Review the due list. This is not a judgment of individual performance.',
      ),
    );
  }
  if (input.workflowFailures >= 3) {
    insights.push(
      insight(
        'workflow_failures',
        'workflows',
        'high',
        'Workflow failure frequency is visible in this period',
        `${input.workflowFailures} finished executions failed or partly completed.`,
        'MEDIUM',
        'Open the failed executions before changing a workflow.',
      ),
    );
  }
  if (input.openExceptions >= 3) {
    insights.push(
      insight(
        'exceptions',
        'operations',
        'medium',
        'Unresolved operational exceptions remain',
        `${input.openExceptions} exceptions are not resolved.`,
        'HIGH',
        'Use the Exception Center rather than creating a duplicate.',
      ),
    );
  }
  for (const item of input.risks) {
    if (insights.some((existing) => existing.key === item.key)) continue;
  }
  return insights;
}

export function workloadSummary(input: {
  open: number;
  overdue: number;
  dueNext7Days: number;
  users: Array<{ userId: string; name: string; open: number; overdue: number }>;
  completionSample: number;
  averageCompletionMs: number | null;
}) {
  const busiest =
    [...input.users].sort((left, right) => right.open - left.open)[0] ?? null;
  return {
    ...input,
    busiest:
      busiest && busiest.open >= 5
        ? { name: busiest.name, open: busiest.open }
        : null,
    note: 'Assigned task counts are workload, not productivity. Working hours and capacity are not stored.',
    completionForecast:
      input.completionSample >= MIN_OBSERVATIONS
        ? ('available' as const)
        : ('INSUFFICIENT_DATA' as const),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function fillWeeks(
  rows: Array<{ week: string | Date; value: number }>,
  from: Date,
  to: Date,
): WeeklyPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const date = row.week instanceof Date ? row.week : new Date(row.week);
    if (Number.isNaN(date.getTime())) continue;
    map.set(
      utcDay(startOfUtcDay(startOfUtcWeek(date))),
      Number(row.value) || 0,
    );
  }
  const points: WeeklyPoint[] = [];
  let cursor = startOfUtcDay(startOfUtcWeek(from));
  const end = startOfUtcDay(startOfUtcWeek(to));
  while (cursor.getTime() <= end.getTime() && points.length < 60) {
    const key = utcDay(cursor);
    points.push({ week: key, value: map.get(key) ?? 0 });
    cursor = new Date(cursor.getTime() + 7 * DAY_MS);
  }
  return points;
}

export function parseBusinessQuery(
  raw: { range?: string; from?: string; to?: string; horizon?: string },
  now = new Date(),
) {
  if (raw.range === 'lifetime') {
    throw new BadRequestException('Lifetime is not a bounded forecast window.');
  }
  const window = resolveDashboardWindow(
    { range: raw.range || '30d', from: raw.from, to: raw.to },
    now,
  );
  if (!window.from || !window.to) {
    throw new BadRequestException('A bounded date range is required.');
  }
  const span = window.to.getTime() - window.from.getTime();
  if (span > MAX_LOOKBACK_DAYS * DAY_MS) {
    throw new BadRequestException(
      `Lookback cannot exceed ${MAX_LOOKBACK_DAYS} days.`,
    );
  }
  const horizon =
    raw.horizon === undefined || raw.horizon === '' ? 7 : Number(raw.horizon);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > MAX_HORIZON_DAYS) {
    throw new BadRequestException(
      `Forecast horizon must be 1 to ${MAX_HORIZON_DAYS} days.`,
    );
  }
  const previous = {
    from: new Date(window.from.getTime() - span),
    to: new Date(window.from.getTime()),
  };
  return { window, horizon, previous };
}

export function assertHorizon(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_HORIZON_DAYS) {
    throw new Error(`Forecast horizon must be 1 to ${MAX_HORIZON_DAYS} days.`);
  }
  return days;
}

export function percentageError(predicted: number, actual: number) {
  if (actual === 0) return null;
  return round1((Math.abs(predicted - actual) / Math.abs(actual)) * 100);
}

function holdoutError(weeks: WeeklyPoint[], integer: boolean) {
  if (weeks.length < 5) return null;
  const train = weeks.slice(0, -1);
  const actual = weeks[weeks.length - 1].value;
  const mean = average(train.map((week) => week.value));
  const predicted = roundValue(mean, integer);
  return {
    predicted,
    actual,
    absoluteError: roundValue(Math.abs(predicted - actual), integer),
    percentageError: percentageError(predicted, actual),
  };
}

function confidenceFor(
  weeks: number,
  mean: number,
  spread: number,
): Confidence {
  const cv = mean === 0 ? 1 : spread / mean;
  if (weeks >= 12 && cv < 0.5) return 'HIGH';
  if (weeks >= 6 && cv < 1) return 'MEDIUM';
  return 'LOW';
}

function emptyWeekWarning(weeks: WeeklyPoint[]) {
  if (weeks.length === 0) return [];
  const empty = weeks.filter((week) => week.value === 0).length;
  return empty > weeks.length / 2
    ? ['More than half of the weekly buckets are zero.']
    : [];
}

function risk(
  key: string,
  category: string,
  severity: RiskDraft['severity'],
  title: string,
  evidence: string,
  comparison: string,
  action: string,
  confidence: Confidence,
  predictive: boolean,
): RiskDraft {
  return {
    key,
    category,
    severity,
    title,
    evidence,
    comparison,
    action,
    confidence,
    predictive,
  };
}

function insight(
  key: string,
  category: string,
  severity: InsightDraft['severity'],
  title: string,
  evidence: string,
  confidence: Confidence,
  recommendation: string,
): InsightDraft {
  return {
    key,
    category,
    severity,
    title,
    description: evidence,
    evidence,
    confidence,
    recommendation,
    suggestion: true,
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function roundValue(value: number, integer: boolean) {
  if (integer) return Math.max(0, Math.round(value));
  return roundMoney(value);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
