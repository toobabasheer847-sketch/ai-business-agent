import type { ConditionContext, WorkflowCondition } from './workflow.types';

export function evaluateConditions(
  conditions: WorkflowCondition[],
  context: ConditionContext,
): { ok: boolean; reason: string } {
  for (const condition of conditions) {
    const actual = readField(condition.field, context);
    if (actual == null) {
      return {
        ok: false,
        reason: `${condition.field} is not available for this trigger.`,
      };
    }
    if (!matches(condition, actual)) {
      return {
        ok: false,
        reason: `${condition.field} is ${actual}, which does not match ${condition.operator} ${condition.value}.`,
      };
    }
  }
  return { ok: true, reason: 'Conditions matched.' };
}

function readField(
  field: WorkflowCondition['field'],
  context: ConditionContext,
): string | null {
  if (field === 'lead.status') return context.leadStatus ?? null;
  if (field === 'task.status') return context.taskStatus ?? null;
  if (field === 'task.dueAt') return context.taskDueAt ?? null;
  if (field === 'proposal.status') return context.proposalStatus ?? null;
  if (field === 'exception.severity') return context.exceptionSeverity ?? null;
  return context.assignedUser ?? null;
}

function matches(condition: WorkflowCondition, actual: string) {
  if (condition.operator === 'eq') return actual === condition.value;
  if (condition.operator === 'neq') return actual !== condition.value;
  const left = new Date(actual).getTime();
  const right = new Date(condition.value).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  if (condition.operator === 'before') return left < right;
  return left > right;
}

export function scheduledDue(
  trigger: { hourUtc?: number; weekday?: number },
  now: Date,
): boolean {
  if (trigger.hourUtc === undefined || now.getUTCHours() !== trigger.hourUtc)
    return false;
  if (trigger.weekday === undefined) return true;
  return now.getUTCDay() === trigger.weekday;
}

export function scheduleReference(workflowId: string, now: Date): string {
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const day = now.toISOString().slice(0, 10);
  return `schedule:${workflowId}:${day}T${hour}`;
}
