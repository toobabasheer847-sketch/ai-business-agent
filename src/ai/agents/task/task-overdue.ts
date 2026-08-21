import type { TaskStatus } from './types/task.types.js';

const CLOSED_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'completed',
  'cancelled',
]);

export function isClosedTaskStatus(status: TaskStatus): boolean {
  return CLOSED_STATUSES.has(status);
}

export function computeIsOverdue(
  status: TaskStatus,
  dueAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (isClosedTaskStatus(status) || !dueAt) {
    return false;
  }

  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < now.getTime();
}
