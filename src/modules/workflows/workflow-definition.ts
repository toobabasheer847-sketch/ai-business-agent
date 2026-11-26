import {
  ACTION_TYPES,
  CONDITION_FIELDS,
  DEFAULT_SETTINGS,
  MAX_ACTIONS,
  MAX_CONDITIONS,
  SENSITIVE_ACTIONS,
  TRIGGER_TYPES,
  WORKFLOW_SCHEMA_VERSION,
  type ActionType,
  type WorkflowDefinition,
} from './workflow.types';

const LEAD_STATUS = new Set([
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
]);
const TASK_STATUS = new Set([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);
const PROPOSAL_STATUS = new Set([
  'draft',
  'generated',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
]);
const SEVERITY = new Set(['critical', 'high', 'medium', 'low']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DefinitionResult =
  | { ok: true; definition: WorkflowDefinition }
  | { ok: false; errors: string[] };

export function validateDefinition(input: unknown): DefinitionResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['A workflow definition must be an object.'] };
  }
  const raw = input as Record<string, unknown>;
  if (raw.schemaVersion !== WORKFLOW_SCHEMA_VERSION)
    errors.push('schemaVersion must be 1.');
  const trigger = readTrigger(raw.trigger, errors);
  const conditions = readConditions(raw.conditions, errors);
  const actions = readActions(raw.actions, errors);
  const settings = readSettings(raw.settings, errors);
  if (!trigger || !conditions || !actions || !settings || errors.length) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    definition: { schemaVersion: 1, trigger, conditions, actions, settings },
  };
}

function readTrigger(
  value: unknown,
  errors: string[],
): WorkflowDefinition['trigger'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('trigger is required.');
    return null;
  }
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (
    typeof type !== 'string' ||
    !TRIGGER_TYPES.includes(type as (typeof TRIGGER_TYPES)[number])
  ) {
    errors.push('trigger.type is not supported.');
    return null;
  }
  const trigger: WorkflowDefinition['trigger'] = {
    type: type as WorkflowDefinition['trigger']['type'],
  };
  if (type === 'scheduled') {
    const hour = raw.hourUtc;
    if (
      typeof hour !== 'number' ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23
    ) {
      errors.push('scheduled triggers require hourUtc from 0 to 23.');
    } else {
      trigger.hourUtc = hour;
    }
    if (raw.weekday !== undefined) {
      const weekday = raw.weekday;
      if (
        typeof weekday !== 'number' ||
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6
      ) {
        errors.push('weekday must be an integer from 0 (Sunday) to 6.');
      } else {
        trigger.weekday = weekday;
      }
    }
  }
  if (type === 'proposal_expiring') {
    const days = raw.withinDays === undefined ? 3 : raw.withinDays;
    if (
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30
    ) {
      errors.push('proposal_expiring withinDays must be from 1 to 30.');
    } else {
      trigger.withinDays = days;
    }
  }
  if (type === 'exception_detected' && raw.severity !== undefined) {
    if (typeof raw.severity !== 'string' || !SEVERITY.has(raw.severity)) {
      errors.push('exception severity must be critical, high, medium, or low.');
    } else {
      trigger.severity =
        raw.severity as WorkflowDefinition['trigger']['severity'];
    }
  }
  return trigger;
}

function readConditions(
  value: unknown,
  errors: string[],
): WorkflowDefinition['conditions'] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push('conditions must be an array.');
    return null;
  }
  if (value.length > MAX_CONDITIONS)
    errors.push(`A workflow can have at most ${MAX_CONDITIONS} conditions.`);
  const conditions: WorkflowDefinition['conditions'] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      errors.push('Each condition must be an object.');
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const field = raw.field;
    const operator = raw.operator;
    const conditionValue = raw.value;
    if (
      typeof field !== 'string' ||
      !CONDITION_FIELDS.includes(field as (typeof CONDITION_FIELDS)[number])
    ) {
      errors.push('A condition field is not supported.');
      continue;
    }
    if (
      operator !== 'eq' &&
      operator !== 'neq' &&
      operator !== 'before' &&
      operator !== 'after'
    ) {
      errors.push('A condition operator is not supported.');
      continue;
    }
    if (
      typeof conditionValue !== 'string' ||
      !conditionValue.trim() ||
      conditionValue.length > 80
    ) {
      errors.push('A condition value must be a short string.');
      continue;
    }
    if (
      field === 'task.dueAt' &&
      operator !== 'before' &&
      operator !== 'after'
    ) {
      errors.push('task.dueAt only supports before and after.');
    }
    if (
      field !== 'task.dueAt' &&
      (operator === 'before' || operator === 'after')
    ) {
      errors.push(`${field} does not support ${operator}.`);
    }
    if (
      field === 'task.dueAt' &&
      Number.isNaN(new Date(conditionValue).getTime())
    ) {
      errors.push('task.dueAt needs an ISO date value.');
    }
    if (!statusAllowed(field, conditionValue))
      errors.push(`${field} value is not supported.`);
    conditions.push({
      field: field as WorkflowDefinition['conditions'][number]['field'],
      operator,
      value: conditionValue.trim(),
    });
  }
  return conditions;
}

function statusAllowed(field: string, value: string) {
  if (field === 'lead.status') return LEAD_STATUS.has(value);
  if (field === 'task.status') return TASK_STATUS.has(value);
  if (field === 'proposal.status') return PROPOSAL_STATUS.has(value);
  if (field === 'exception.severity') return SEVERITY.has(value);
  return true;
}

function readActions(
  value: unknown,
  errors: string[],
): WorkflowDefinition['actions'] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('At least one action is required.');
    return null;
  }
  if (value.length > MAX_ACTIONS)
    errors.push(`A workflow can have at most ${MAX_ACTIONS} actions.`);
  const actions: WorkflowDefinition['actions'] = [];
  const keys = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      errors.push('Each action must be an object.');
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const key = raw.key;
    const type = raw.type;
    if (typeof key !== 'string' || !/^[a-z0-9-]{1,40}$/.test(key)) {
      errors.push(
        'Each action key must be 1-40 lowercase letters, numbers, or hyphens.',
      );
      continue;
    }
    if (keys.has(key)) errors.push(`Action key ${key} is duplicated.`);
    keys.add(key);
    if (
      typeof type !== 'string' ||
      !ACTION_TYPES.includes(type as ActionType)
    ) {
      errors.push(`Action ${key} uses an unsupported type.`);
      continue;
    }
    const input = readInput(raw.input, key, errors);
    if (!input) continue;
    validateActionInput(type as ActionType, input, key, errors);
    actions.push({ key, type: type as ActionType, input });
  }
  return actions;
}

function readInput(
  value: unknown,
  key: string,
  errors: string[],
): Record<string, string> | null {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Action ${key} input must be an object of strings.`);
    return null;
  }
  const input: Record<string, string> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 12)
    errors.push(`Action ${key} has too many input fields.`);
  for (const [field, entry] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(field)) {
      errors.push(`Action ${key} has an unsupported input field.`);
      continue;
    }
    if (typeof entry !== 'string' || entry.length > 500) {
      errors.push(
        `Action ${key} field ${field} must be a string of at most 500 characters.`,
      );
      continue;
    }
    if (/token|password|secret|api[_-]?key/i.test(field)) {
      errors.push(`Action ${key} cannot store secrets.`);
      continue;
    }
    input[field] = entry.trim();
  }
  return input;
}

function validateActionInput(
  type: ActionType,
  input: Record<string, string>,
  key: string,
  errors: string[],
) {
  if (type === 'create_task' || type === 'create_proposal_reminder') {
    if (!input.title || input.title.length < 3)
      errors.push(`Action ${key} needs a title of at least 3 characters.`);
  }
  if (type === 'update_task' || type === 'assign_task') {
    if (!input.taskId) errors.push(`Action ${key} needs taskId.`);
  }
  if (type === 'assign_task' && !input.assignedTo)
    errors.push(`Action ${key} needs assignedTo.`);
  if (type === 'update_lead' && !input.leadId && !input.useTriggerLead) {
    errors.push(`Action ${key} needs leadId or useTriggerLead.`);
  }
  if (
    type === 'update_lead' &&
    input.status &&
    !LEAD_STATUS.has(input.status)
  ) {
    errors.push(`Action ${key} has an unsupported lead status.`);
  }
  if (type === 'send_email') {
    if (!input.to || !EMAIL.test(input.to))
      errors.push(`Action ${key} needs a valid recipient email.`);
    if (!input.subject) errors.push(`Action ${key} needs a subject.`);
    if (!input.body) errors.push(`Action ${key} needs a body.`);
  }
  if (type === 'send_sms' || type === 'send_whatsapp') {
    if (!input.to) errors.push(`Action ${key} needs a recipient phone number.`);
    if (!input.body && !input.providerTemplateRef) errors.push(`Action ${key} needs a message body.`);
    if (type === 'send_sms' && !input.fromPhoneNumberId)
      errors.push(`Action ${key} needs fromPhoneNumberId.`);
    if (input.purpose && !['transactional', 'customer_requested', 'marketing'].includes(input.purpose)) {
      errors.push(`Action ${key} has an unsupported purpose.`);
    }
  }
  if (type === 'create_email_draft' && !input.body)
    errors.push(`Action ${key} needs a draft body.`);
  if (type === 'create_sms_draft' && !input.body)
    errors.push(`Action ${key} needs a draft body.`);
  if (
    (type === 'create_internal_notification' ||
      type === 'prepare_proposal_follow_up' ||
      type === 'generate_business_summary') &&
    !input.message &&
    !input.topic &&
    !input.title
  ) {
    errors.push(`Action ${key} needs a message, topic, or title.`);
  }
  if (SENSITIVE_ACTIONS.has(type) && input.autoSend === 'true') {
    errors.push(`Action ${key} cannot bypass approval.`);
  }
}

function readSettings(
  value: unknown,
  errors: string[],
): WorkflowDefinition['settings'] | null {
  if (value === undefined) return { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('settings must be an object.');
    return null;
  }
  const raw = value as Record<string, unknown>;
  const maxRetries =
    raw.maxRetries === undefined ? DEFAULT_SETTINGS.maxRetries : raw.maxRetries;
  const timeoutMs =
    raw.timeoutMs === undefined ? DEFAULT_SETTINGS.timeoutMs : raw.timeoutMs;
  if (
    typeof maxRetries !== 'number' ||
    !Number.isInteger(maxRetries) ||
    maxRetries < 0 ||
    maxRetries > 3
  ) {
    errors.push('maxRetries must be an integer from 0 to 3.');
  }
  if (
    typeof timeoutMs !== 'number' ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 120_000
  ) {
    errors.push('timeoutMs must be from 1000 to 120000.');
  }
  if (errors.length) return null;
  return { maxRetries: maxRetries as number, timeoutMs: timeoutMs as number };
}
