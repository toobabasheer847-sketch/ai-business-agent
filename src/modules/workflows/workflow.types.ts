export const WORKFLOW_SCHEMA_VERSION = 1;

export const WORKFLOW_STATUSES = ['draft', 'active', 'paused'] as const;
export const EXECUTION_STATUSES = [
  'queued',
  'running',
  'waiting_for_approval',
  'completed',
  'partially_completed',
  'failed',
  'cancelled',
  'retrying',
] as const;
export const STEP_STATUSES = [
  'pending',
  'running',
  'waiting_for_approval',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const;

export const TRIGGER_TYPES = [
  'manual',
  'scheduled',
  'new_lead',
  'task_overdue',
  'proposal_expiring',
  'approval_completed',
  'exception_detected',
] as const;

export const ACTION_TYPES = [
  'create_task',
  'update_task',
  'assign_task',
  'update_lead',
  'create_internal_notification',
  'generate_business_summary',
  'create_email_draft',
  'create_sms_draft',
  'send_email',
  'send_sms',
  'create_proposal_reminder',
  'prepare_proposal_follow_up',
] as const;

export const SENSITIVE_ACTIONS = new Set<ActionType>([
  'send_email',
  'send_sms',
]);

export const CONDITION_FIELDS = [
  'lead.status',
  'task.status',
  'task.dueAt',
  'proposal.status',
  'exception.severity',
  'assignedUser',
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type TriggerType = (typeof TRIGGER_TYPES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export type WorkflowCondition = {
  field: ConditionField;
  operator: 'eq' | 'neq' | 'before' | 'after';
  value: string;
};

export type WorkflowAction = {
  key: string;
  type: ActionType;
  input: Record<string, string>;
};

export type WorkflowDefinition = {
  schemaVersion: 1;
  trigger: {
    type: TriggerType;
    hourUtc?: number;
    weekday?: number;
    withinDays?: number;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  settings: {
    maxRetries: number;
    timeoutMs: number;
  };
};

export type ConditionContext = {
  leadStatus?: string;
  taskStatus?: string;
  taskDueAt?: string;
  proposalStatus?: string;
  exceptionSeverity?: string;
  assignedUser?: string;
  leadId?: string;
  taskId?: string;
  proposalId?: string;
  exceptionId?: string;
  approvalId?: string;
};

export type WorkflowRecord = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  triggerType: TriggerType;
  definition: WorkflowDefinition;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  activatedAt: Date | null;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowExecution = {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowVersion: number;
  triggerSource: 'manual' | 'schedule' | 'event';
  triggerReference: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  sanitizedError: string | null;
  executionContext: ConditionContext;
  triggeredBy: string | null;
  definitionSnapshot: WorkflowDefinition;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowStep = {
  id: string;
  tenantId: string;
  executionId: string;
  stepKey: string;
  actionType: ActionType;
  status: StepStatus;
  inputSnapshot: Record<string, string>;
  outputSnapshot: Record<string, unknown>;
  approvalId: string | null;
  attemptCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  sanitizedError: string | null;
  createdAt: Date;
};

export type ActionOutcome =
  | { status: 'completed'; output: Record<string, unknown> }
  | { status: 'waiting'; approvalId: string; output: Record<string, unknown> }
  | { status: 'failed'; retryable: boolean; errorCode: string; error: string };

export const MAX_ACTIONS = 8;
export const MAX_CONDITIONS = 8;
export const DEFAULT_SETTINGS = { maxRetries: 2, timeoutMs: 30_000 };
