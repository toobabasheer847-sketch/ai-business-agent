import type { ExceptionSeverity } from './exception.types';

const SEVERITY_BASE: Record<ExceptionSeverity, number> = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};

export type PriorityInput = {
  severity: ExceptionSeverity;
  daysOverdue: number;
  occurrenceCount: number;
  acknowledged: boolean;
};

export type PriorityResult = {
  score: number;
  reason: string;
};

export function scoreException(input: PriorityInput): PriorityResult {
  const base = SEVERITY_BASE[input.severity];
  const overdueBonus = Math.min(20, Math.max(0, input.daysOverdue) * 2);
  const repeatBonus = Math.min(15, Math.max(0, input.occurrenceCount - 1) * 3);
  const attention = input.acknowledged ? -15 : 10;
  const score = clamp(base + overdueBonus + repeatBonus + attention, 0, 100);
  const parts = [`${label(input.severity)} severity`];
  if (input.daysOverdue > 0)
    parts.push(
      `overdue by ${input.daysOverdue} day${input.daysOverdue === 1 ? '' : 's'}`,
    );
  if (input.occurrenceCount > 1)
    parts.push(`seen ${input.occurrenceCount} times`);
  parts.push(
    input.acknowledged ? 'already acknowledged' : 'not yet acknowledged',
  );
  return {
    score,
    reason: `Priority ${score} because this is ${parts.join(', ')}.`,
  };
}

function label(severity: ExceptionSeverity) {
  if (severity === 'critical') return 'Critical';
  if (severity === 'high') return 'High';
  if (severity === 'medium') return 'Medium';
  return 'Low';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
