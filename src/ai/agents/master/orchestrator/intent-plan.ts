import { ForbiddenException } from '@nestjs/common';
import { z } from 'zod';

import {
  analyticsActions,
  isAnalyticsQuestion,
} from '../../../../modules/analytics/analytics-intent.js';
import { isTeamQuestion } from '../../team/team-intent.js';

export function isBusinessIntelligenceQuestion(message: string): boolean {
  const text = message.trim().toLowerCase();
  return /\b(?:biggest risks|proposal pipeline|sales trends|workflows need attention|focus on this week|business intelligence|business performing)\b/.test(
    text,
  );
}

export function isImprovementQuestion(message: string): boolean {
  const text = message.trim().toLowerCase();
  return /\b(?:why are my business goals not progressing|business processes need improvement|bottlenecks are affecting|action plans have measurable|improvements should we prioritize|review my active strategic plans|changed since our last business review|which recommendations were useful|what should we improve next|plan to improve our task completion)\b/.test(
    text,
  );
}

export function isStrategicQuestion(message: string): boolean {
  const text = message.trim().toLowerCase();
  return /\b(?:focus on today|top three business priorities|business priorities|improve my sales pipeline|business opportunities|plan to reduce overdue|business goals progressing|recommendations have been successful|team work on next|recommendation marked high priority|strategic decisions)\b/.test(
    text,
  );
}

export const ORCHESTRATION_AGENTS = [
  'crm',
  'task',
  'proposal',
  'communication',
  'analytics',
  'knowledge',
  'team',
] as const;

export type OrchestrationAgent = (typeof ORCHESTRATION_AGENTS)[number];

export const ALLOWED_ACTIONS = [
  'company.create',
  'company.read',
  'lead.create',
  'prospect.create',
  'prospect.followup',
  'proposal.create',
  'proposal.read',
  'proposal.send',
  'task.create',
  'task.overdue',
  'communication.summary',
  'dashboard.read',
  'record.delete',
  'knowledge.answer',
  'team.analyze',
  'analytics.overview',
  'analytics.sales',
  'analytics.proposals',
  'analytics.tasks',
  'business.intelligence',
  'strategic.decision',
  'improvement.review',
] as const;

export type OrchestrationAction = (typeof ALLOWED_ACTIONS)[number];

export const OPERATION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'awaiting_confirmation',
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

const ACTION_AGENT: Record<OrchestrationAction, OrchestrationAgent> = {
  'company.create': 'crm',
  'company.read': 'crm',
  'lead.create': 'crm',
  'prospect.create': 'crm',
  'prospect.followup': 'crm',
  'proposal.create': 'proposal',
  'proposal.read': 'proposal',
  'proposal.send': 'proposal',
  'task.create': 'task',
  'task.overdue': 'task',
  'communication.summary': 'communication',
  'dashboard.read': 'analytics',
  'record.delete': 'knowledge',
  'knowledge.answer': 'knowledge',
  'team.analyze': 'team',
  'analytics.overview': 'analytics',
  'analytics.sales': 'analytics',
  'analytics.proposals': 'analytics',
  'analytics.tasks': 'analytics',
  'business.intelligence': 'analytics',
  'strategic.decision': 'analytics',
  'improvement.review': 'analytics',
};

const READ_ACTIONS = new Set<OrchestrationAction>([
  'company.read',
  'prospect.followup',
  'proposal.read',
  'task.overdue',
  'communication.summary',
  'dashboard.read',
  'knowledge.answer',
  'team.analyze',
  'analytics.overview',
  'analytics.sales',
  'analytics.proposals',
  'analytics.tasks',
  'business.intelligence',
  'strategic.decision',
  'improvement.review',
]);

const SENSITIVE_ACTIONS = new Set<OrchestrationAction>([
  'proposal.send',
  'record.delete',
]);

export type PlannedOperation = {
  operationId: string;
  intent: OrchestrationAction;
  selectedAgent: OrchestrationAgent;
  action: OrchestrationAction;
  requiredInputs: Record<string, string>;
  dependencies: string[];
  executionMode: 'parallel' | 'sequential';
  permissionRequirements: string[];
  status: OperationStatus;
  missing: string[];
  sensitive: boolean;
  summary?: string;
  entityId?: string;
  outputs?: Record<string, string>;
  failureCategory?: string;
  durationMs?: number;
};

export type DetectionResult = {
  intents: OrchestrationAction[];
  operations: PlannedOperation[];
  clarification: string | null;
};

const modelIntentSchema = z
  .object({
    intents: z
      .array(
        z
          .object({
            action: z.string().max(80),
            inputs: z
              .record(z.string().max(40), z.string().max(200))
              .optional(),
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

export function validateModelIntentPayload(
  raw: unknown,
  userMessage: string,
):
  | {
      ok: true;
      intents: Array<{
        action: OrchestrationAction;
        inputs: Record<string, string>;
      }>;
    }
  | { ok: false; reason: string } {
  const parsedJson = typeof raw === 'string' ? safeJson(raw) : raw;
  const parsed = modelIntentSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_model_output' };
  }

  const intents: Array<{
    action: OrchestrationAction;
    inputs: Record<string, string>;
  }> = [];
  for (const item of parsed.data.intents) {
    if (!isAllowedAction(item.action)) {
      continue;
    }
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(item.inputs ?? {})) {
      if (
        key === 'tenantId' ||
        key === 'sql' ||
        key === 'query' ||
        key === 'code'
      ) {
        continue;
      }
      if (!valueAppearsInMessage(value, userMessage)) {
        continue;
      }
      inputs[key] = value.trim();
    }
    intents.push({ action: item.action, inputs });
  }

  return { ok: true, intents };
}

export function detectIntents(message: string): DetectionResult {
  const text = message.trim();
  const companyName = extractCompanyName(text);
  const person = extractPerson(text);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const recordId = text.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  )?.[0];

  const wantsCompany =
    /\b(?:create|add|new)\b[\s\S]{0,40}\bcompan/i.test(text) ||
    /\bcompany\b[\s\S]{0,30}\b(?:called|named)\b/i.test(text);
  const wantsLead =
    /\b(?:add|create)\b[\s\S]{0,40}\b(?:lead|contact)\b/i.test(text) ||
    /\b(?:ceo|contact)\b[\s\S]{0,20}\bas a lead\b/i.test(text) ||
    /\badd its ceo\b/i.test(text);
  const wantsProposalCreate =
    /\b(?:create|generate|write|draft|make)\b[\s\S]{0,60}\b(?:proposal|quotation|quote)\b/i.test(
      text,
    );
  const wantsProposalRead =
    /\bproposal\b/i.test(text) &&
    /\b(?:status|accepted|rejected|whether|find|show)\b/i.test(text);
  const wantsSend =
    /\b(?:send|email)\b[\s\S]{0,50}\b(?:proposal|quotation|quote|client)\b/i.test(
      text,
    );
  const wantsTask =
    /\b(?:task|follow-up|follow up)\b/i.test(text) &&
    /\b(?:create|add|schedule|set|remind)\b/i.test(text);
  const wantsAnalytics = isAnalyticsQuestion(text);
  const wantsBusinessIntelligence = isBusinessIntelligenceQuestion(text);
  const wantsTeam = isTeamQuestion(text) && !wantsAnalytics;
  const wantsOverdue =
    /\boverdue\b/i.test(text) &&
    /\btasks?\b/i.test(text) &&
    !wantsTeam &&
    !wantsAnalytics;
  const wantsComms =
    /\b(?:communications?|emails?|inbox|calls?|sms)\b/i.test(text) &&
    /\b(?:summarize|summary|recent|show)\b/i.test(text);
  const wantsProspectFollowup =
    /\bprospects?\b/i.test(text) && /\bfollow-?up\b/i.test(text);
  const wantsDashboard =
    /\b(?:dashboard|kpis?|metrics|pipeline)\b/i.test(text) && !wantsAnalytics;
  const wantsDelete = /\b(?:delete|remove|erase|destroy)\b/i.test(text);
  const wantsKnowledge =
    /\b(?:policy|refund|document|documents|knowledge|uploaded|wiki|faq)\b/i.test(
      text,
    );

  const selected: OrchestrationAction[] = [];
  const push = (action: OrchestrationAction) => {
    if (!selected.includes(action)) selected.push(action);
  };

  const wantsImprovement = isImprovementQuestion(text);
  const wantsStrategic = isStrategicQuestion(text);
  if (wantsImprovement) {
    push('improvement.review');
  } else if (wantsStrategic) {
    push('strategic.decision');
  } else {
    if (wantsCompany) push('company.create');
    if (wantsLead) push('lead.create');
    if (wantsProposalCreate) push('proposal.create');
    if (wantsProposalRead && !wantsProposalCreate) push('proposal.read');
    if (wantsSend) push('proposal.send');
    if (wantsTask) push('task.create');
    if (wantsOverdue) push('task.overdue');
    if (wantsComms) push('communication.summary');
    if (wantsProspectFollowup) push('prospect.followup');
    if (wantsDashboard) push('dashboard.read');
    if (wantsDelete) push('record.delete');
    if (wantsTeam) push('team.analyze');
    if (wantsAnalytics) {
      for (const action of analyticsActions(text)) push(action);
    }
    if (wantsBusinessIntelligence) push('business.intelligence');
    if (wantsKnowledge && selected.length > 0) push('knowledge.answer');
    if (wantsKnowledge && selected.length === 0) push('knowledge.answer');
  }

  if (
    selected.includes('proposal.create') &&
    selected.includes('lead.create') &&
    !selected.includes('prospect.create')
  ) {
    selected.splice(selected.indexOf('proposal.create'), 0, 'prospect.create');
  }

  const operations = buildPlan(selected, {
    companyName,
    firstName: person.firstName,
    lastName: person.lastName,
    jobTitle: person.jobTitle,
    email,
    recordId,
    proposalSubject: companyName,
  });

  return {
    intents: operations.map((operation) => operation.action),
    operations,
    clarification: clarificationFor(operations),
  };
}

export function assertTenantScopedInputs(
  operations: PlannedOperation[],
  tenantId: string,
): void {
  for (const operation of operations) {
    const supplied = operation.requiredInputs.tenantId;
    if (supplied && supplied !== tenantId) {
      throw new ForbiddenException('Tenant override is not allowed');
    }
  }
}

export function shouldOrchestrate(message: string): boolean {
  const detected = detectIntents(message);
  if (detected.operations.length === 0) return false;
  if (detected.clarification) return true;
  if (
    detected.operations.some((operation) => operation.sensitive) &&
    detected.operations.length > 1
  ) {
    return true;
  }
  if (detected.operations.length === 1) {
    const only = detected.operations[0];
    return (
      only.selectedAgent === 'crm' ||
      only.selectedAgent === 'analytics' ||
      only.selectedAgent === 'team' ||
      only.action === 'record.delete'
    );
  }
  const agents = new Set(
    detected.operations.map((operation) => operation.selectedAgent),
  );
  if (
    agents.size === 1 &&
    (agents.has('proposal') ||
      agents.has('task') ||
      agents.has('communication') ||
      agents.has('knowledge'))
  ) {
    return false;
  }
  return true;
}

type PlanFacts = {
  companyName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  recordId?: string;
  proposalSubject?: string;
};

function buildPlan(
  actions: OrchestrationAction[],
  facts: PlanFacts,
): PlannedOperation[] {
  const operations: PlannedOperation[] = [];
  const idFor = new Map<OrchestrationAction, string>();

  actions.forEach((action, index) => {
    const operationId = `op-${index + 1}`;
    idFor.set(action, operationId);
    const inputs: Record<string, string> = {};
    const missing: string[] = [];

    if (action === 'company.create') {
      if (facts.companyName) inputs.companyName = facts.companyName;
      else missing.push('companyName');
    }
    if (action === 'lead.create' || action === 'prospect.create') {
      if (facts.firstName) inputs.firstName = facts.firstName;
      else missing.push('firstName');
      if (facts.lastName) inputs.lastName = facts.lastName;
      if (facts.jobTitle) inputs.jobTitle = facts.jobTitle;
      if (facts.email) inputs.email = facts.email;
      if (facts.companyName) inputs.companyName = facts.companyName;
    }
    if (action === 'proposal.create' || action === 'proposal.read') {
      const subject = facts.proposalSubject ?? facts.companyName;
      if (subject) inputs.companyName = subject;
      else if (action === 'proposal.create') missing.push('companyName');
    }
    if (action === 'task.create') {
      const company = facts.companyName ?? 'the new company';
      inputs.title = facts.companyName
        ? `Follow up with ${facts.companyName}`
        : 'Follow up';
      if (company) inputs.companyName = facts.companyName ?? '';
    }
    if (action === 'record.delete') {
      if (facts.recordId) inputs.recordId = facts.recordId;
      else missing.push('recordId');
    }

    const dependencies: string[] = [];
    if (action === 'lead.create' && idFor.get('company.create')) {
      dependencies.push(idFor.get('company.create') as string);
    }
    if (action === 'prospect.create' && idFor.get('lead.create')) {
      dependencies.push(idFor.get('lead.create') as string);
    }
    if (action === 'proposal.create' && idFor.get('prospect.create')) {
      dependencies.push(idFor.get('prospect.create') as string);
    } else if (action === 'proposal.create' && idFor.get('lead.create')) {
      dependencies.push(idFor.get('lead.create') as string);
    }
    if (action === 'proposal.send' && idFor.get('proposal.create')) {
      dependencies.push(idFor.get('proposal.create') as string);
    }
    if (action === 'task.create' && idFor.get('proposal.create')) {
      dependencies.push(idFor.get('proposal.create') as string);
    } else if (action === 'task.create' && idFor.get('company.create')) {
      dependencies.push(idFor.get('company.create') as string);
    }

    const read = READ_ACTIONS.has(action);
    operations.push({
      operationId,
      intent: action,
      selectedAgent: action === 'record.delete' ? 'crm' : ACTION_AGENT[action],
      action,
      requiredInputs: inputs,
      dependencies,
      executionMode: read ? 'parallel' : 'sequential',
      permissionRequirements: ['authenticated-tenant'],
      status: 'pending',
      missing,
      sensitive: SENSITIVE_ACTIONS.has(action),
    });
  });

  return operations;
}

function clarificationFor(operations: PlannedOperation[]): string | null {
  const missing = operations.flatMap((operation) =>
    operation.missing.map((field) => ({ action: operation.action, field })),
  );
  if (!missing.length) return null;
  const questions: string[] = [];
  if (missing.some((item) => item.field === 'companyName')) {
    questions.push('What is the company name?');
  }
  if (missing.some((item) => item.field === 'firstName')) {
    questions.push("What is the person's name?");
  }
  if (
    missing.some(
      (item) => item.action === 'record.delete' && item.field === 'recordId',
    )
  ) {
    questions.push(
      'Which record should be deleted? Send the record id from the CRM page.',
    );
  }
  return questions.join(' ');
}

export type OperationHandlerResult = {
  summary: string;
  entityId?: string;
  outputs?: Record<string, string>;
  awaitingApproval?: boolean;
};

export async function executePlan(options: {
  operations: PlannedOperation[];
  handlers: Partial<
    Record<
      OrchestrationAction,
      (
        operation: PlannedOperation,
        completed: Map<string, PlannedOperation>,
      ) => Promise<OperationHandlerResult>
    >
  >;
  timeoutMs?: number;
  isReplay?: (
    operation: PlannedOperation,
  ) => Promise<OperationHandlerResult | null>;
}): Promise<PlannedOperation[]> {
  const operations = options.operations.map((operation) => ({
    ...operation,
    requiredInputs: { ...operation.requiredInputs },
  }));
  const timeoutMs = options.timeoutMs ?? 30_000;
  const completed = new Map<string, PlannedOperation>();

  if (operations.some((operation) => operation.missing.length > 0)) {
    return operations.map((operation) => ({
      ...operation,
      status: 'skipped',
      failureCategory: operation.missing.length
        ? 'missing_input'
        : 'dependency_skipped',
      summary: operation.missing.length
        ? `Missing ${operation.missing.join(', ')}.`
        : 'Skipped until the missing details are provided.',
    }));
  }

  const unfinished = () =>
    operations.filter((operation) => operation.status === 'pending');

  while (unfinished().length > 0) {
    const pending = unfinished();
    for (const operation of pending) {
      const deps = operation.dependencies.map((id) =>
        operations.find((item) => item.operationId === id),
      );
      if (deps.some((dep) => !dep || dep.status !== 'completed')) {
        const blocked = deps.some(
          (dep) =>
            dep &&
            dep.status !== 'pending' &&
            dep.status !== 'running' &&
            dep.status !== 'completed',
        );
        if (blocked) {
          operation.status = 'skipped';
          operation.failureCategory = 'dependency_failed';
          operation.summary =
            'Skipped because an earlier step did not complete.';
        }
      }
    }

    const ready = unfinished().filter((operation) =>
      operation.dependencies.every((id) => completed.has(id)),
    );
    if (!ready.length) break;

    const reads = ready.filter(
      (operation) =>
        operation.executionMode === 'parallel' && !operation.sensitive,
    );
    if (reads.length > 0) {
      await Promise.all(
        reads.map((operation) =>
          runOperation(operation, options, completed, timeoutMs),
        ),
      );
      continue;
    }

    await runOperation(ready[0], options, completed, timeoutMs);
  }

  return operations;
}

async function runOperation(
  operation: PlannedOperation,
  options: {
    handlers: Partial<
      Record<
        OrchestrationAction,
        (
          operation: PlannedOperation,
          completed: Map<string, PlannedOperation>,
        ) => Promise<OperationHandlerResult>
      >
    >;
    isReplay?: (
      operation: PlannedOperation,
    ) => Promise<OperationHandlerResult | null>;
  },
  completed: Map<string, PlannedOperation>,
  timeoutMs: number,
) {
  if (operation.sensitive) {
    const proposal = [...completed.values()].find(
      (item) => item.outputs?.proposalId,
    );
    operation.status = 'awaiting_confirmation';
    operation.outputs = {
      ...(operation.requiredInputs.recordId
        ? { recordId: operation.requiredInputs.recordId }
        : {}),
      ...(proposal?.outputs?.proposalId
        ? { proposalId: proposal.outputs.proposalId }
        : {}),
    };
    operation.summary =
      operation.action === 'proposal.send'
        ? 'Sending the proposal needs your confirmation.'
        : 'This delete needs your confirmation.';
    return;
  }

  const started = Date.now();
  operation.status = 'running';
  try {
    const replay = options.isReplay ? await options.isReplay(operation) : null;
    if (replay) {
      operation.status = 'completed';
      operation.summary = replay.summary;
      operation.entityId = replay.entityId;
      operation.outputs = replay.outputs;
      operation.durationMs = Date.now() - started;
      completed.set(operation.operationId, operation);
      return;
    }

    const handler = options.handlers[operation.action];
    if (!handler) {
      operation.status = 'failed';
      operation.failureCategory = 'unsupported';
      operation.summary = 'This action is not available.';
      operation.durationMs = Date.now() - started;
      return;
    }

    const result = await withTimeout(handler(operation, completed), timeoutMs);
    if (result.awaitingApproval) {
      operation.status = 'awaiting_confirmation';
      operation.summary = result.summary;
      operation.outputs = result.outputs;
      operation.durationMs = Date.now() - started;
      return;
    }
    operation.status = 'completed';
    operation.summary = result.summary;
    operation.entityId = result.entityId;
    operation.outputs = result.outputs;
    operation.durationMs = Date.now() - started;
    completed.set(operation.operationId, operation);
  } catch (error) {
    operation.status = 'failed';
    operation.failureCategory =
      error instanceof Error && error.message === 'timeout'
        ? 'timeout'
        : 'execution_error';
    operation.summary =
      operation.failureCategory === 'timeout'
        ? 'The operation timed out before the service confirmed it.'
        : error instanceof Error
          ? error.message
          : 'The operation failed.';
    operation.durationMs = Date.now() - started;
  }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function summarizeOperations(
  operations: PlannedOperation[],
  clarification: string | null,
): string {
  if (clarification) return clarification;
  const lines = operations.map((operation) => {
    const label = operation.summary ?? operation.action;
    if (operation.status === 'completed') return `Completed: ${label}`;
    if (operation.status === 'failed') return `Failed: ${label}`;
    if (operation.status === 'skipped') return `Skipped: ${label}`;
    if (operation.status === 'awaiting_confirmation')
      return `Needs confirmation: ${label}`;
    return label;
  });
  return lines.join('\n');
}

export function orchestrationStatus(
  operations: PlannedOperation[],
  clarification: string | null,
): string {
  if (clarification) return 'awaiting_clarification';
  if (
    operations.some((operation) => operation.status === 'awaiting_confirmation')
  ) {
    return operations.some((operation) => operation.status === 'failed')
      ? 'partial'
      : 'awaiting_confirmation';
  }
  if (operations.every((operation) => operation.status === 'completed'))
    return 'completed';
  if (operations.some((operation) => operation.status === 'completed'))
    return 'partial';
  if (operations.every((operation) => operation.status === 'skipped'))
    return 'skipped';
  return 'failed';
}

function extractCompanyName(text: string): string | undefined {
  const match =
    text.match(
      /\b(?:company|business)\s+(?:called|named)\s+["']?([^,"'\n.]+)/i,
    ) ?? text.match(/\bproposal\s+for\s+["']?([^,"'\n.]+)/i);
  const name = match?.[1]?.trim();
  if (!name || name.length < 2 || /^(its|a|the|me|this)$/i.test(name))
    return undefined;
  return name.slice(0, 255);
}

function extractPerson(text: string): {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
} {
  const jobTitle = /\bceo\b/i.test(text) ? 'CEO' : undefined;
  const match =
    text.match(/\b(?:named|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) ??
    text.match(
      /\badd\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+as\s+(?:a\s+)?(?:lead|contact|the\s+ceo|ceo)\b/,
    ) ??
    text.match(/\bCEO\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const raw = match?.[1]?.trim();
  if (!raw || /^(Its|The|A)$/.test(raw)) {
    return { jobTitle };
  }
  const [firstName, ...rest] = raw.split(/\s+/);
  return { firstName, lastName: rest.join(' ') || undefined, jobTitle };
}

function valueAppearsInMessage(value: string, message: string): boolean {
  const needle = value.trim().toLowerCase();
  if (needle.length < 2) return false;
  return message.toLowerCase().includes(needle);
}

function isAllowedAction(value: string): value is OrchestrationAction {
  return (ALLOWED_ACTIONS as readonly string[]).includes(value);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
