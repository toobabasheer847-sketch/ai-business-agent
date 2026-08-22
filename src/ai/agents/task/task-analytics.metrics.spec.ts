import {
  buildAnalyticsResult,
  emptyActivity,
  emptyCrm,
  emptyPriority,
  emptyReminders,
  emptySummary,
  iterateTrendPeriods,
  mergeTrendRows,
  percent,
  resolveAnalyticsRange,
  toCount,
} from './task-analytics.metrics';

describe('task analytics metrics', () => {
  it('calculates completion and overdue rates and never returns NaN', () => {
    const result = buildAnalyticsResult({
      summary: {
        ...emptySummary(),
        total: 20,
        pending: 8,
        inProgress: 3,
        completed: 7,
        cancelled: 2,
        overdue: 4,
      },
      priority: { ...emptyPriority(), medium: 10, high: 6, urgent: 2, low: 2 },
      crm: { ...emptyCrm(), company: 8, prospect: 5, lead: 4, unlinked: 3 },
      reminders: { ...emptyReminders(), scheduled: 5, sent: 8, failed: 1, disabled: 3 },
      activity: emptyActivity(),
    });

    expect(result.completionRate).toBe(35);
    expect(result.overdueRate).toBe(20);
    expect(result.reminderSuccessRate).toBe(89);
    expect(result.reminderFailureRate).toBe(11);
  });

  it('handles zero-task analytics without NaN or Infinity', () => {
    const result = buildAnalyticsResult({
      summary: emptySummary(),
      priority: emptyPriority(),
      crm: emptyCrm(),
      reminders: emptyReminders(),
      activity: emptyActivity(),
    });

    expect(result.completionRate).toBe(0);
    expect(result.overdueRate).toBe(0);
    expect(result.reminderSuccessRate).toBe(0);
    expect(result.reminderFailureRate).toBe(0);
    expect(Number.isFinite(result.completionRate)).toBe(true);
  });

  it('rounds percentages consistently', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
    expect(toCount('4')).toBe(4);
    expect(toCount(undefined)).toBe(0);
  });

  it('rejects inverted and invalid date ranges', () => {
    expect(
      resolveAnalyticsRange({
        from: '2026-08-22T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      }).ok,
    ).toBe(false);
    expect(resolveAnalyticsRange({ from: 'not-a-date' }).ok).toBe(false);
    expect(
      resolveAnalyticsRange({
        from: '2026-01-01T00:00:00.000Z',
        to: '2027-12-31T00:00:00.000Z',
        maxDays: 366,
      }).ok,
    ).toBe(false);
  });

  it('groups trend periods by day, week, and month', () => {
    const days = iterateTrendPeriods(
      new Date('2026-08-20T00:00:00.000Z'),
      new Date('2026-08-22T00:00:00.000Z'),
      'day',
    );
    expect(days).toEqual(['2026-08-20', '2026-08-21', '2026-08-22']);

    const weeks = iterateTrendPeriods(
      new Date('2026-08-17T00:00:00.000Z'),
      new Date('2026-08-24T00:00:00.000Z'),
      'week',
    );
    expect(weeks[0]).toBe('2026-08-17');
    expect(weeks).toContain('2026-08-24');

    const months = iterateTrendPeriods(
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-08-22T00:00:00.000Z'),
      'month',
    );
    expect(months).toEqual(['2026-07-01', '2026-08-01']);
  });

  it('merges created, completed, and overdue trend buckets', () => {
    expect(
      mergeTrendRows(
        ['2026-08-22'],
        [{ period: '2026-08-22', count: 5 }],
        [{ period: '2026-08-22', count: 3 }],
        [{ period: '2026-08-22', count: 1 }],
      ),
    ).toEqual([{ period: '2026-08-22', created: 5, completed: 3, overdue: 1 }]);
  });
});
