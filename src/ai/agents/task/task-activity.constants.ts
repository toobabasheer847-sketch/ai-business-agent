export const TASK_ACTIVITY_ENTITY_TYPE = 'task';

export const TASK_ACTIVITY_EVENTS = [
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_COMPLETED',
  'TASK_CANCELLED',
  'TASK_REOPENED',
  'TASK_CRM_LINKED',
  'TASK_CRM_UNLINKED',
  'REMINDER_SCHEDULED',
  'REMINDER_SENT',
  'REMINDER_FAILED',
] as const;

export type TaskActivityEventType = (typeof TASK_ACTIVITY_EVENTS)[number];

const SECRET_KEY_RE =
  /token|password|secret|credential|authorization|api[_-]?key|refresh|oauth|access[_-]?token/i;

export function isTaskActivityEventType(
  value: string,
): value is TaskActivityEventType {
  return (TASK_ACTIVITY_EVENTS as readonly string[]).includes(value);
}

export function mapLegacyActivityAction(action: string): TaskActivityEventType | null {
  if (isTaskActivityEventType(action)) {
    return action;
  }

  if (action === 'task.reminder.sent') {
    return 'REMINDER_SENT';
  }
  if (action === 'task.reminder.failed') {
    return 'REMINDER_FAILED';
  }

  return null;
}

export function sanitizeActivityMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY_RE.test(key) || key === 'recipientEmail') {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      cleaned[key] = sanitizeActivityMetadata(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
