import { ACTION_TYPES } from './workflow.types';

export const HEALTH_MIN_TERMINAL = 3;
export const P95_MIN_SAMPLE = 5;
export const SLOW_MIN_SAMPLE = 5;
export const SLOW_RATIO = 1.5;
export const REPEATED_FAILURE_COUNT = 3;
export const RETRY_STEP_COUNT = 3;
export const APPROVAL_WAIT_MIN_SAMPLE = 3;
export const APPROVAL_WAIT_MS = 4 * 60 * 60 * 1000;
export const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export const DEFAULT_BASELINE_SECONDS: Record<string, number> = {
  create_task: 180,
  update_task: 90,
  assign_task: 60,
  update_lead: 120,
  create_internal_notification: 60,
  generate_business_summary: 600,
  create_email_draft: 300,
  create_sms_draft: 120,
  create_proposal_reminder: 180,
  prepare_proposal_follow_up: 300,
};

const BASELINE_ACTIONS = new Set(Object.keys(DEFAULT_BASELINE_SECONDS));

export type StatusCounts = {
  completed: number;
  failed: number;
  partiallyCompleted: number;
  cancelled: number;
  running: number;
  waiting: number;
  otherOpen: number;
};

export type RateSummary = {
  total: number;
  terminalEligible: number;
  successful: number;
  failed: number;
  successRate: number | null;
  failureRate: number | null;
  classification: string;
};

export type DurationSummary = {
  sample: number;
  averageMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
};

export type HealthResult = {
  score: number | null;
  label: 'HEALTHY' | 'NEEDS_ATTENTION' | 'UNHEALTHY' | 'INSUFFICIENT_DATA';
  factors: string[];
};

export type SavingsLine = {
  actionType: string;
  completed: number;
  baselineSeconds: number;
  estimatedSeconds: number;
};

export type SavingsEstimate = {
  status: 'estimated' | 'insufficient' | 'no_baseline';
  estimatedSeconds: number | null;
  label: string;
  lines: SavingsLine[];
  skippedActions: string[];
};

export type AgentRunFact = {
  parentRunId: string | null;
  status: string;
  usageStatus: string;
  costStatus: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedTotalCost: string | null;
  currency: string | null;
  durationMs: number | null;
};

export type AiUsageSummary = {
  scope: 'workflow_generation';
  associatedWithExecutions: false;
  totalRuns: number;
  failedRuns: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: string | null;
  currency: string | null;
  mixedCurrencies: boolean;
  pricingNotConfiguredRuns: number;
  usageUnavailableRuns: number;
  averageDurationMs: number | null;
  billedCost: null;
  note: string;
};

export type RecommendationDraft = {
  key: string;
  workflowId: string | null;
  rule: string;
  title: string;
  evidence: string;
  suggestion: string;
  impact: string;
  metrics: Record<string, number | string>;
};

const RATE_CLASSIFICATION =
  'Success is a completed execution, including a run that stopped because its conditions did not match. Failure is failed plus partially completed. Cancelled, running, queued, retrying, and waiting executions are excluded. Retries stay on the same execution.';

export function emptyCounts(): StatusCounts {
  return {
    completed: 0,
    failed: 0,
    partiallyCompleted: 0,
    cancelled: 0,
    running: 0,
    waiting: 0,
    otherOpen: 0,
  };
}

export function addStatus(counts: StatusCounts, status: string, total = 1) {
  if (status === 'completed') counts.completed += total;
  else if (status === 'failed') counts.failed += total;
  else if (status === 'partially_completed') counts.partiallyCompleted += total;
  else if (status === 'cancelled') counts.cancelled += total;
  else if (status === 'running' || status === 'queued' || status === 'retrying')
    counts.running += total;
  else if (status === 'waiting_for_approval') counts.waiting += total;
  else counts.otherOpen += total;
}

export function executionRates(counts: StatusCounts): RateSummary {
  const successful = counts.completed;
  const failed = counts.failed + counts.partiallyCompleted;
  const terminalEligible = successful + failed;
  const total =
    terminalEligible +
    counts.cancelled +
    counts.running +
    counts.waiting +
    counts.otherOpen;
  if (terminalEligible === 0) {
    return {
      total,
      terminalEligible,
      successful,
      failed,
      successRate: null,
      failureRate: null,
      classification: RATE_CLASSIFICATION,
    };
  }
  return {
    total,
    terminalEligible,
    successful,
    failed,
    successRate: round1((successful / terminalEligible) * 100),
    failureRate: round1((failed / terminalEligible) * 100),
    classification: RATE_CLASSIFICATION,
  };
}

export function summarizeDurations(values: number[]): DurationSummary {
  const sample = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (sample.length === 0) {
    return { sample: 0, averageMs: null, medianMs: null, p95Ms: null };
  }
  const average = sample.reduce((sum, value) => sum + value, 0) / sample.length;
  const mid = Math.floor(sample.length / 2);
  const median =
    sample.length % 2 === 1 ? sample[mid] : (sample[mid - 1] + sample[mid]) / 2;
  const p95Index = Math.ceil(sample.length * 0.95) - 1;
  return {
    sample: sample.length,
    averageMs: Math.round(average),
    medianMs: Math.round(median),
    p95Ms:
      sample.length >= P95_MIN_SAMPLE ? Math.round(sample[p95Index]) : null,
  };
}

export function workflowHealth(input: {
  terminalEligible: number;
  successRate: number | null;
  repeatedFailure: boolean;
  slowVersusPrior: boolean;
  approvalBottleneck: boolean;
}): HealthResult {
  if (
    input.terminalEligible < HEALTH_MIN_TERMINAL ||
    input.successRate === null
  ) {
    return {
      score: null,
      label: 'INSUFFICIENT_DATA',
      factors: [
        `Fewer than ${HEALTH_MIN_TERMINAL} finished executions in this period.`,
      ],
    };
  }
  let score = input.successRate;
  const factors = [
    `Success rate is ${input.successRate}% of finished executions.`,
  ];
  if (input.repeatedFailure) {
    score -= 15;
    factors.push('The same sanitized error occurred at least 3 times.');
  }
  if (input.slowVersusPrior) {
    score -= 10;
    factors.push(
      'A step is slower than 1.5 times its previous-period average.',
    );
  }
  if (input.approvalBottleneck) {
    score -= 10;
    factors.push('Approval steps waited at least 4 hours on average.');
  }
  score = clamp(Math.round(score), 0, 100);
  return {
    score,
    label:
      score >= 80 ? 'HEALTHY' : score >= 50 ? 'NEEDS_ATTENTION' : 'UNHEALTHY',
    factors,
  };
}

export function parseBaselines(raw: string | undefined | null): {
  source: 'environment' | 'built_in_assumption';
  seconds: Record<string, number>;
} {
  if (!raw?.trim())
    return {
      source: 'built_in_assumption',
      seconds: { ...DEFAULT_BASELINE_SECONDS },
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      source: 'built_in_assumption',
      seconds: { ...DEFAULT_BASELINE_SECONDS },
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      source: 'built_in_assumption',
      seconds: { ...DEFAULT_BASELINE_SECONDS },
    };
  }
  const seconds: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (
      !BASELINE_ACTIONS.has(key) ||
      !ACTION_TYPES.includes(key as (typeof ACTION_TYPES)[number])
    )
      continue;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 8 * 60 * 60
    )
      continue;
    seconds[key] = value;
  }
  if (Object.keys(seconds).length === 0) {
    return {
      source: 'built_in_assumption',
      seconds: { ...DEFAULT_BASELINE_SECONDS },
    };
  }
  return { source: 'environment', seconds };
}

export function estimateSavings(
  actions: Array<{ actionType: string; completed: number }>,
  baselines: Record<string, number>,
): SavingsEstimate {
  const lines: SavingsLine[] = [];
  const skippedActions: string[] = [];
  let completed = 0;
  for (const action of actions) {
    if (action.completed <= 0) continue;
    completed += action.completed;
    const baseline = baselines[action.actionType];
    if (baseline === undefined) {
      skippedActions.push(action.actionType);
      continue;
    }
    lines.push({
      actionType: action.actionType,
      completed: action.completed,
      baselineSeconds: baseline,
      estimatedSeconds: action.completed * baseline,
    });
  }
  if (completed === 0) {
    return {
      status: 'insufficient',
      estimatedSeconds: null,
      label: 'Not enough completed actions to estimate time saved.',
      lines: [],
      skippedActions: [],
    };
  }
  if (lines.length === 0) {
    return {
      status: 'no_baseline',
      estimatedSeconds: null,
      label: 'Completed actions have no configured manual baseline.',
      lines: [],
      skippedActions,
    };
  }
  return {
    status: 'estimated',
    estimatedSeconds: lines.reduce(
      (sum, line) => sum + line.estimatedSeconds,
      0,
    ),
    label:
      'Estimated from configured manual baselines. This is not measured labor time.',
    lines,
    skippedActions,
  };
}

export function summarizeWorkflowAi(runs: AgentRunFact[]): AiUsageSummary {
  const parents = runs.filter((run) => !run.parentRunId);
  const reported = parents.filter((run) => run.usageStatus === 'reported');
  const priced = parents.filter(
    (run) =>
      run.costStatus === 'estimated' && run.estimatedTotalCost && run.currency,
  );
  const currencies = new Set(priced.map((run) => run.currency));
  const durations = parents
    .map((run) => run.durationMs)
    .filter((value): value is number => value !== null && value >= 0);
  const note =
    parents.length === 0
      ? 'No workflow-generation model calls were recorded in this period. Workflow execution does not call a model.'
      : 'These runs are workflow-generation calls. They are not attached to a workflow execution, and the cost is an estimate when pricing is configured.';
  return {
    scope: 'workflow_generation',
    associatedWithExecutions: false,
    totalRuns: parents.length,
    failedRuns: parents.filter((run) => run.status === 'failed').length,
    inputTokens: reported.some((run) => run.inputTokens !== null)
      ? reported.reduce((sum, run) => sum + (run.inputTokens ?? 0), 0)
      : null,
    outputTokens: reported.some((run) => run.outputTokens !== null)
      ? reported.reduce((sum, run) => sum + (run.outputTokens ?? 0), 0)
      : null,
    totalTokens: reported.some((run) => run.totalTokens !== null)
      ? reported.reduce((sum, run) => sum + (run.totalTokens ?? 0), 0)
      : null,
    estimatedCost:
      currencies.size === 1
        ? addCosts(priced.map((run) => run.estimatedTotalCost as string))
        : null,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    mixedCurrencies: currencies.size > 1,
    pricingNotConfiguredRuns: parents.filter(
      (run) => run.costStatus === 'pricing_not_configured',
    ).length,
    usageUnavailableRuns: parents.filter(
      (run) => run.usageStatus === 'unavailable',
    ).length,
    averageDurationMs: durations.length
      ? Math.round(
          durations.reduce((sum, value) => sum + value, 0) / durations.length,
        )
      : null,
    billedCost: null,
    note,
  };
}

export function buildRecommendations(input: {
  failures: Array<{
    workflowId: string;
    workflowName: string;
    errorCode: string;
    count: number;
  }>;
  slow: Array<{
    workflowId: string;
    workflowName: string;
    actionType: string;
    currentAvgMs: number;
    priorAvgMs: number;
    sample: number;
    priorSample: number;
  }>;
  approvals: Array<{
    workflowId: string;
    workflowName: string;
    averageWaitMs: number;
    sample: number;
  }>;
  unused: Array<{ workflowId: string; workflowName: string }>;
  retries: Array<{
    workflowId: string;
    workflowName: string;
    actionType: string;
    retriedSteps: number;
  }>;
}): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  for (const failure of input.failures) {
    if (failure.count < REPEATED_FAILURE_COUNT || !failure.errorCode) continue;
    drafts.push({
      key: `repeated_failure:${failure.workflowId}:${failure.errorCode}`,
      workflowId: failure.workflowId,
      rule: 'repeated_failure',
      title: `${failure.workflowName} failed repeatedly`,
      evidence: `${failure.workflowName} recorded ${failure.count} finished executions with error ${failure.errorCode}. ${failureExplanation(failure.errorCode)}`,
      suggestion: failureSuggestion(failure.errorCode),
      impact: `${failure.count} executions in this period ended with ${failure.errorCode}.`,
      metrics: { count: failure.count, errorCode: failure.errorCode },
    });
  }
  for (const slow of input.slow) {
    if (
      slow.sample < SLOW_MIN_SAMPLE ||
      slow.priorSample < SLOW_MIN_SAMPLE ||
      slow.priorAvgMs <= 0
    )
      continue;
    if (slow.currentAvgMs < slow.priorAvgMs * SLOW_RATIO) continue;
    drafts.push({
      key: `slow_execution:${slow.workflowId}:${slow.actionType}`,
      workflowId: slow.workflowId,
      rule: 'slow_execution',
      title: `${slow.workflowName} has a slower ${slow.actionType} step`,
      evidence: `Average ${slow.actionType} duration is ${Math.round(slow.currentAvgMs)} ms across ${slow.sample} steps, compared with ${Math.round(slow.priorAvgMs)} ms across ${slow.priorSample} steps in the previous period.`,
      suggestion: 'Inspect that action and the records it depends on.',
      impact: `The step is at least ${SLOW_RATIO} times its previous average.`,
      metrics: {
        currentAvgMs: Math.round(slow.currentAvgMs),
        priorAvgMs: Math.round(slow.priorAvgMs),
        sample: slow.sample,
      },
    });
  }
  for (const approval of input.approvals) {
    if (
      approval.sample < APPROVAL_WAIT_MIN_SAMPLE ||
      approval.averageWaitMs < APPROVAL_WAIT_MS
    )
      continue;
    drafts.push({
      key: `approval_bottleneck:${approval.workflowId}`,
      workflowId: approval.workflowId,
      rule: 'approval_bottleneck',
      title: `${approval.workflowName} waits on approval`,
      evidence: `${approval.sample} approval steps waited ${Math.round(approval.averageWaitMs / 60000)} minutes on average.`,
      suggestion:
        'Review who can approve these actions and whether the requests are reaching them.',
      impact: 'Sensitive actions stay paused until a person decides.',
      metrics: {
        sample: approval.sample,
        averageWaitMs: Math.round(approval.averageWaitMs),
      },
    });
  }
  for (const unused of input.unused) {
    drafts.push({
      key: `unused_workflow:${unused.workflowId}`,
      workflowId: unused.workflowId,
      rule: 'unused_workflow',
      title: `${unused.workflowName} did not run`,
      evidence: `${unused.workflowName} is active and recorded no executions in this period.`,
      suggestion: 'Review whether its trigger still matches current records.',
      impact:
        'An active workflow with no runs does not automate the work it describes.',
      metrics: { executions: 0 },
    });
  }
  for (const retry of input.retries) {
    if (retry.retriedSteps < RETRY_STEP_COUNT) continue;
    drafts.push({
      key: `repeated_retries:${retry.workflowId}:${retry.actionType}`,
      workflowId: retry.workflowId,
      rule: 'repeated_retries',
      title: `${retry.workflowName} retries ${retry.actionType}`,
      evidence: `${retry.retriedSteps} ${retry.actionType} steps needed more than one attempt. Each execution is still counted once.`,
      suggestion:
        'Review the retry limit and the error recorded on that action.',
      impact: `${retry.retriedSteps} steps were retried.`,
      metrics: {
        retriedSteps: retry.retriedSteps,
        actionType: retry.actionType,
      },
    });
  }
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    if (seen.has(draft.key)) return false;
    seen.add(draft.key);
    return true;
  });
}

export function assertRecommendationStatus(
  status: string,
): 'open' | 'reviewed' | 'dismissed' | 'applied' {
  const normalized = status.trim().toLowerCase();
  if (
    normalized === 'open' ||
    normalized === 'reviewed' ||
    normalized === 'dismissed' ||
    normalized === 'applied'
  ) {
    return normalized;
  }
  throw new Error(
    'Recommendation status must be open, reviewed, dismissed, or applied.',
  );
}

function failureExplanation(code: string) {
  if (code === 'not_found')
    return 'The action could not find the referenced record in this tenant.';
  if (code === 'invalid_input')
    return 'The action input did not match the registry.';
  if (code === 'provider_timeout')
    return 'The provider timed out and the step was not retried.';
  if (code.startsWith('approval_'))
    return 'The Approval Center did not execute the action.';
  return 'The stored error code is the only failure detail.';
}

function failureSuggestion(code: string) {
  if (code === 'not_found')
    return 'Confirm the task, lead, or proposal still belongs to this tenant.';
  if (code === 'invalid_input')
    return 'Review the action fields saved on the workflow.';
  if (code === 'provider_timeout')
    return 'Check the provider status before running the workflow again.';
  if (code.startsWith('approval_'))
    return 'Review the approval decision and approver availability.';
  return 'Open the failed execution and review the step that recorded this error.';
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addCosts(values: string[]) {
  const total = values.reduce((sum, value) => sum + toScaled(value), 0n);
  const negative = total < 0n;
  const digits = (negative ? -total : total).toString().padStart(9, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -8) || '0'}.${digits.slice(-8)}`;
}

function toScaled(value: string) {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  return (
    BigInt(`${whole}${fraction.padEnd(8, '0').slice(0, 8)}`) *
    (negative ? -1n : 1n)
  );
}
