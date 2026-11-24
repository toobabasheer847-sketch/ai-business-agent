export const CONFIDENCE_WEIGHT = { HIGH: 1, MEDIUM: 0.7, LOW: 0.4 } as const;

export type DecisionConfidence = keyof typeof CONFIDENCE_WEIGHT;

export const SIGNAL_WEIGHTS = {
  stale_leads: { impact: 3, urgency: 3, category: 'sales' },
  expiring_proposals: { impact: 4, urgency: 5, category: 'sales' },
  old_pending_proposals: { impact: 3, urgency: 3, category: 'pipeline' },
  acceptance_drop: { impact: 4, urgency: 3, category: 'pipeline' },
  overdue_tasks: { impact: 4, urgency: 4, category: 'operations' },
  workflow_failures: { impact: 4, urgency: 4, category: 'automation' },
  open_exceptions: { impact: 3, urgency: 3, category: 'operations' },
  agent_failures: { impact: 2, urgency: 3, category: 'automation' },
  pricing_gap: { impact: 1, urgency: 1, category: 'automation' },
  pending_approvals: { impact: 3, urgency: 4, category: 'operations' },
} as const;

export type SignalKey = keyof typeof SIGNAL_WEIGHTS;

export type PriorityItem = {
  key: SignalKey;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  impact: number;
  urgency: number;
  confidence: DecisionConfidence;
  evidence: string;
  action: string;
  outcome: string;
  permission: string;
  approvalRequired: false;
};

export function priorityScore(
  impact: number,
  urgency: number,
  confidence: DecisionConfidence,
) {
  const boundedImpact = clamp(impact, 1, 5);
  const boundedUrgency = clamp(urgency, 1, 5);
  const weight = CONFIDENCE_WEIGHT[confidence];
  return Math.round((boundedImpact * boundedUrgency * weight * 100) / 25);
}

export function rankSignals(
  signals: Array<{
    key: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    confidence: string;
    evidence: string;
    action: string;
  }>,
): PriorityItem[] {
  const ranked: PriorityItem[] = [];
  for (const signal of signals) {
    if (!isSignalKey(signal.key)) continue;
    if (!isConfidence(signal.confidence)) continue;
    const weight = SIGNAL_WEIGHTS[signal.key];
    ranked.push({
      key: signal.key,
      title: signal.title,
      description: signal.description,
      category: weight.category,
      severity: signal.severity,
      score: priorityScore(weight.impact, weight.urgency, signal.confidence),
      impact: weight.impact,
      urgency: weight.urgency,
      confidence: signal.confidence,
      evidence: signal.evidence,
      action: signal.action,
      outcome: expectedOutcome(signal.key),
      permission: 'analytics.view',
      approvalRequired: false,
    });
  }
  return ranked.sort(
    (left, right) =>
      right.score - left.score || left.key.localeCompare(right.key),
  );
}

export type OpportunityItem = {
  key: string;
  name: string;
  description: string;
  category: string;
  evidence: string;
  benefit: string;
  effort: null;
  confidence: DecisionConfidence;
  nextStep: string;
  limitation: string;
};

export function discoverOpportunities(input: {
  staleNewLeads: number;
  expiringProposals: number;
  leadsCreated: number;
  previousLeads: number;
  acceptanceRate: number | null;
  previousAcceptanceRate: number | null;
  acceptanceSample: number;
  previousAcceptanceSample: number;
  workflowFailures: number;
}): OpportunityItem[] {
  const items: OpportunityItem[] = [];
  if (input.staleNewLeads >= 3) {
    items.push(
      opportunity(
        'follow_up_stale_leads',
        'Review leads that are still new',
        'sales',
        `${input.staleNewLeads} leads created more than seven days ago are still new.`,
        'A review can show which leads still need a recorded follow-up. No revenue change is estimated.',
        'HIGH',
        'Open the stale-lead list and record a real follow-up or status.',
      ),
    );
  }
  if (input.expiringProposals >= 1) {
    items.push(
      opportunity(
        'review_expiring_proposals',
        'Review proposals that expire soon',
        'pipeline',
        `${input.expiringProposals} sent or viewed proposals expire within seven days.`,
        'Reviewing them can prevent a proposal from lapsing unnoticed. Acceptance is not guaranteed.',
        'HIGH',
        'Open those proposals and decide whether a person should contact the prospect.',
      ),
    );
  }
  if (input.previousLeads >= 8 && input.leadsCreated > input.previousLeads) {
    items.push(
      opportunity(
        'lead_activity_up',
        'Lead creation is higher than the previous period',
        'sales',
        `${input.leadsCreated} leads were created, compared with ${input.previousLeads} in the previous period.`,
        'This is a measured count comparison. It does not estimate revenue.',
        'MEDIUM',
        'Compare the sources of the two periods before adding a target.',
      ),
    );
  }
  if (
    input.acceptanceRate !== null &&
    input.previousAcceptanceRate !== null &&
    input.acceptanceSample >= 8 &&
    input.previousAcceptanceSample >= 8 &&
    input.acceptanceRate - input.previousAcceptanceRate >= 15
  ) {
    items.push(
      opportunity(
        'acceptance_up',
        'Proposal acceptance is higher than the previous period',
        'pipeline',
        `Acceptance is ${input.acceptanceRate}% from ${input.acceptanceSample} decisions, compared with ${input.previousAcceptanceRate}%.`,
        'This is a measured rate comparison. It does not predict the next period.',
        'MEDIUM',
        'Keep the comparison visible. Do not treat it as a guaranteed trend.',
      ),
    );
  }
  if (input.workflowFailures >= 3) {
    items.push(
      opportunity(
        'inspect_workflow_failures',
        'Inspect repeated workflow failures',
        'automation',
        `${input.workflowFailures} finished workflow executions failed or partly completed in this period.`,
        'Finding the shared error can reduce repeated failures. No time saving is calculated here.',
        'MEDIUM',
        'Open workflow analytics before changing a workflow.',
      ),
    );
  }
  return items;
}

export type RecommendationDraft = {
  key: string;
  title: string;
  description: string;
  category: string;
  score: number;
  confidence: DecisionConfidence;
  evidence: string[];
  reasoning: string;
  action: string;
  outcome: string;
  permission: string;
  approvalRequired: boolean;
};

export function buildRecommendations(
  priorities: PriorityItem[],
  opportunities: OpportunityItem[],
): RecommendationDraft[] {
  const seen = new Set<string>();
  const drafts: RecommendationDraft[] = [];
  for (const priority of priorities) {
    if (seen.has(priority.key)) continue;
    seen.add(priority.key);
    drafts.push({
      key: priority.key,
      title: priority.title,
      description: priority.description,
      category: priority.category,
      score: priority.score,
      confidence: priority.confidence,
      evidence: [priority.evidence],
      reasoning: `${priority.title} scores ${priority.score} from impact ${priority.impact}, urgency ${priority.urgency}, and ${priority.confidence} confidence. The score is not a probability.`,
      action: priority.action,
      outcome: priority.outcome,
      permission: priority.permission,
      approvalRequired: false,
    });
  }
  for (const item of opportunities) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    drafts.push({
      key: item.key,
      title: item.name,
      description: item.description,
      category: item.category,
      score: 0,
      confidence: item.confidence,
      evidence: [item.evidence, item.limitation],
      reasoning:
        'This is an opportunity notice. It is not ranked as a priority and it does not claim a financial result.',
      action: item.nextStep,
      outcome: item.benefit,
      permission: 'analytics.view',
      approvalRequired: false,
    });
  }
  return drafts;
}

export function actionStepsFor(title: string) {
  return [
    {
      actionType: 'review',
      title: 'Review the evidence',
      description: `Read the stored counts behind "${title}" before changing a record. This step is complete only when a person marks it.`,
    },
    {
      actionType: 'create_task',
      title: `Follow up: ${title}`.slice(0, 240),
      description:
        'Create one internal task for a manager. This does not email or text a customer.',
    },
  ];
}

export const PLAN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

const PLAN_MOVES: Record<PlanStatus, PlanStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertPlanMove(from: string, to: PlanStatus) {
  const allowed = PLAN_MOVES[from as PlanStatus] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`A ${from} plan cannot move to ${to}.`);
  }
}

export const GOAL_METRICS = {
  overdue_task_count: {
    direction: 'lower',
    label: 'Open tasks that are overdue now',
  },
  stale_lead_count: {
    direction: 'lower',
    label: 'Leads still new after seven days',
  },
  open_exception_count: {
    direction: 'lower',
    label: 'Unresolved operational exceptions',
  },
  workflow_failure_count: {
    direction: 'lower',
    label: 'Failed or partial workflow executions in 30 days',
  },
  proposal_acceptance_rate: {
    direction: 'higher',
    label: 'Proposal acceptance rate for decided proposals',
  },
  leads_created: { direction: 'higher', label: 'Leads created in 30 days' },
} as const;

export type GoalMetricKey = keyof typeof GOAL_METRICS;

export function goalProgress(input: {
  direction: 'higher' | 'lower';
  baseline: number | null;
  current: number | null;
  target: number | null;
}) {
  if (
    input.baseline === null ||
    input.current === null ||
    input.target === null
  ) {
    return {
      progress: null as number | null,
      reason: 'A baseline, current value, or target is missing.',
    };
  }
  if (input.target === input.baseline) {
    return {
      progress: null as number | null,
      reason:
        'Progress is withheld until the target differs from the baseline.',
    };
  }
  const span =
    input.direction === 'higher'
      ? input.target - input.baseline
      : input.baseline - input.target;
  if (span === 0) {
    return {
      progress: null as number | null,
      reason: 'The target does not move the metric.',
    };
  }
  const traveled =
    input.direction === 'higher'
      ? input.current - input.baseline
      : input.baseline - input.current;
  return {
    progress: clamp(Math.round((traveled / span) * 100), 0, 100),
    reason: null as string | null,
  };
}

export function outcomeWording(
  before: number | null,
  after: number | null,
  label: string,
) {
  if (before === null || after === null) {
    return `${label} cannot be compared because a before or after value is missing.`;
  }
  if (after === before)
    return `${label} was ${before} before and ${after} after. No change was measured.`;
  const direction = after > before ? 'higher' : 'lower';
  return `${label} was ${before} before and ${after} after, so it is ${direction}. This does not show that an action caused the change.`;
}

export function evidenceIsCurrent(
  key: string,
  currentKeys: string[],
  expiresAt: Date,
  now: Date,
) {
  if (expiresAt.getTime() <= now.getTime()) return false;
  return currentKeys.includes(key);
}

export function executionKind(actionType: string, approvalRequired: boolean) {
  if (
    [
      'email.send',
      'sms.send',
      'proposal.send',
      'company.delete',
      'record.delete',
    ].includes(actionType)
  ) {
    return 'blocked_sensitive' as const;
  }
  if (actionType === 'review') return 'manual' as const;
  if (actionType === 'create_task' && approvalRequired)
    return 'await_approval' as const;
  if (actionType === 'create_task') return 'create_task' as const;
  if (actionType === 'start_workflow') return 'start_workflow' as const;
  return 'unsupported' as const;
}

const SIGNAL_KEYS = new Set<string>(Object.keys(SIGNAL_WEIGHTS));
const GOAL_KEYS = new Set<string>(Object.keys(GOAL_METRICS));

export function isSignalKey(value: string): value is SignalKey {
  return SIGNAL_KEYS.has(value);
}

export function isGoalMetric(value: string): value is GoalMetricKey {
  return GOAL_KEYS.has(value);
}

function expectedOutcome(key: SignalKey) {
  if (key === 'overdue_tasks') {
    return 'A person can review the current overdue list. The count is not described as an increase.';
  }
  if (key === 'pricing_gap') {
    return 'Missing AI prices stay blank. No cost is estimated.';
  }
  return 'A person can review the evidence. Success is not guaranteed.';
}

function opportunity(
  key: string,
  name: string,
  category: string,
  evidence: string,
  benefit: string,
  confidence: DecisionConfidence,
  nextStep: string,
): OpportunityItem {
  return {
    key,
    name,
    description: evidence,
    category,
    evidence,
    benefit,
    effort: null,
    confidence,
    nextStep,
    limitation: 'No monetary savings or revenue growth is calculated.',
  };
}

function isConfidence(value: string): value is DecisionConfidence {
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
