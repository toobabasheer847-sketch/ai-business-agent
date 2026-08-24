import {
  computeNextOccurrence,
  isOccurrenceWithinEnd,
  isRecurrenceInterval,
  occurrenceKeyFromDate,
} from './compute-task-recurrence';

describe('compute-task-recurrence', () => {
  it('validates recurrence intervals', () => {
    expect(isRecurrenceInterval('daily')).toBe(true);
    expect(isRecurrenceInterval('weekly')).toBe(true);
    expect(isRecurrenceInterval('monthly')).toBe(true);
    expect(isRecurrenceInterval('yearly')).toBe(false);
  });

  it('computes daily, weekly, and monthly next occurrences', () => {
    const from = new Date('2026-08-24T12:00:00.000Z');
    expect(computeNextOccurrence(from, 'daily').toISOString()).toBe(
      '2026-08-25T12:00:00.000Z',
    );
    expect(computeNextOccurrence(from, 'weekly').toISOString()).toBe(
      '2026-08-31T12:00:00.000Z',
    );
    expect(computeNextOccurrence(from, 'monthly').toISOString()).toBe(
      '2026-09-24T12:00:00.000Z',
    );
  });

  it('builds occurrence keys and respects end dates', () => {
    const next = new Date('2026-08-25T12:00:00.000Z');
    expect(occurrenceKeyFromDate(next)).toBe('2026-08-25');
    expect(isOccurrenceWithinEnd(next, '2026-08-25T23:59:59.000Z')).toBe(true);
    expect(isOccurrenceWithinEnd(next, '2026-08-24T23:59:59.000Z')).toBe(false);
    expect(isOccurrenceWithinEnd(next, null)).toBe(true);
  });
});
