export const RECURRENCE_INTERVALS = ['daily', 'weekly', 'monthly'] as const;

export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export function isRecurrenceInterval(
  value: string | null | undefined,
): value is RecurrenceInterval {
  return (
    typeof value === 'string' &&
    (RECURRENCE_INTERVALS as readonly string[]).includes(value)
  );
}

export function occurrenceKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeNextOccurrence(
  from: Date,
  interval: RecurrenceInterval,
): Date {
  const next = new Date(from.getTime());
  if (interval === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (interval === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function isOccurrenceWithinEnd(
  nextDue: Date,
  endsAt?: Date | string | null,
): boolean {
  if (!endsAt) {
    return true;
  }
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) {
    return true;
  }
  return nextDue.getTime() <= end.getTime();
}
