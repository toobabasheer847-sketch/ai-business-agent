import { computeIsOverdue } from './task-overdue';

describe('computeIsOverdue', () => {
  const past = '2026-08-20T10:00:00.000Z';
  const future = '2026-08-21T10:00:00.000Z';
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('marks pending tasks with a past dueAt as overdue', () => {
    expect(computeIsOverdue('pending', past, now)).toBe(true);
    expect(computeIsOverdue('in_progress', past, now)).toBe(true);
  });

  it('does not mark pending tasks with a future dueAt as overdue', () => {
    expect(computeIsOverdue('pending', future, now)).toBe(false);
  });

  it('does not mark completed or cancelled tasks as overdue', () => {
    expect(computeIsOverdue('completed', past, now)).toBe(false);
    expect(computeIsOverdue('cancelled', past, now)).toBe(false);
  });

  it('does not mark tasks without a dueAt as overdue', () => {
    expect(computeIsOverdue('pending', null, now)).toBe(false);
  });
});
