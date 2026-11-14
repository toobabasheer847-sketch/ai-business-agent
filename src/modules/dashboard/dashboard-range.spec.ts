import { BadRequestException } from '@nestjs/common';

import {
  currentTaskWindows,
  isOpenOverdueTask,
  resolveDashboardWindow,
} from './dashboard-range';

describe('dashboard range', () => {
  const now = new Date('2026-11-14T15:00:00.000Z');

  it('keeps lifetime totals unfiltered', () => {
    expect(resolveDashboardWindow({}, now)).toEqual({
      preset: 'lifetime',
      from: null,
      to: null,
      timezone: 'UTC',
    });
  });

  it('builds rolling UTC windows for 7, 30, and 90 days', () => {
    const week = resolveDashboardWindow({ range: '7d' }, now);
    expect(week.from?.toISOString()).toBe('2026-11-07T15:00:00.000Z');
    expect(week.to?.toISOString()).toBe(now.toISOString());
    expect(resolveDashboardWindow({ range: '30d' }, now).from?.toISOString()).toBe(
      '2026-10-15T15:00:00.000Z',
    );
    expect(resolveDashboardWindow({ range: '90d' }, now).from?.toISOString()).toBe(
      '2026-08-16T15:00:00.000Z',
    );
  });

  it('accepts a custom UTC date range and rejects an inverted one', () => {
    const window = resolveDashboardWindow(
      { range: 'custom', from: '2026-11-01', to: '2026-11-14' },
      now,
    );
    expect(window.from?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(window.to?.toISOString()).toBe('2026-11-14T23:59:59.999Z');

    expect(() =>
      resolveDashboardWindow({ range: 'custom', from: '2026-11-14', to: '2026-11-01' }, now),
    ).toThrow(BadRequestException);
    expect(() => resolveDashboardWindow({ range: 'custom' }, now)).toThrow(BadRequestException);
  });

  it('treats open tasks with a past due date as overdue', () => {
    expect(isOpenOverdueTask('pending', '2026-11-13T00:00:00.000Z', now)).toBe(true);
    expect(isOpenOverdueTask('in_progress', '2026-11-13T00:00:00.000Z', now)).toBe(true);
    expect(isOpenOverdueTask('completed', '2026-11-13T00:00:00.000Z', now)).toBe(false);
    expect(isOpenOverdueTask('cancelled', '2026-11-13T00:00:00.000Z', now)).toBe(false);
    expect(isOpenOverdueTask('pending', null, now)).toBe(false);
    expect(isOpenOverdueTask('pending', '2026-11-14T18:00:00.000Z', now)).toBe(false);
  });

  it('places due today and this week on UTC calendar bounds', () => {
    const bounds = currentTaskWindows(now);
    expect(bounds.todayStart.toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(bounds.todayEnd.toISOString()).toBe('2026-11-14T23:59:59.999Z');
    expect(bounds.weekStart.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(bounds.weekEnd.toISOString()).toBe('2026-11-15T23:59:59.999Z');
  });
});
