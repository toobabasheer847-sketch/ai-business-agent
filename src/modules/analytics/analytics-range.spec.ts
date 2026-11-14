import { BadRequestException } from '@nestjs/common';

import { compareMetric, previousWindow, rate, resolveAnalyticsWindow, windowFromMessage } from './analytics-range';

describe('analytics ranges', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  it('uses the previous 30 days for a 30 day range', () => {
    const current = resolveAnalyticsWindow({ range: '30d' }, now);
    const previous = previousWindow(current);
    expect(current.from?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(current.to?.toISOString()).toBe('2026-11-14T12:00:00.000Z');
    expect(previous?.to?.toISOString()).toBe('2026-10-15T11:59:59.999Z');
    expect((previous!.to!.getTime() - previous!.from!.getTime())).toBe(current.to!.getTime() - current.from!.getTime());
  });

  it('keeps custom UTC day bounds and rejects an inverted range', () => {
    const current = resolveAnalyticsWindow({ range: 'custom', from: '2026-11-01', to: '2026-11-14' }, now);
    expect(current.from?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(current.to?.toISOString()).toBe('2026-11-14T23:59:59.999Z');
    expect(() => resolveAnalyticsWindow({ range: 'custom', from: '2026-11-14', to: '2026-11-01' })).toThrow(BadRequestException);
    expect(() => resolveAnalyticsWindow({ range: 'lifetime' })).toThrow(BadRequestException);
  });

  it('does not return Infinity or NaN when the previous value is zero', () => {
    const comparison = compareMetric(4, 0);
    expect(comparison.percentChange).toBeNull();
    expect(comparison.difference).toBe(4);
    expect(comparison.direction).toBe('up');
    expect(JSON.stringify(comparison)).not.toMatch(/Infinity|NaN/);
    expect(rate(1, 0, 'test').percent).toBeNull();
  });

  it('maps this month and last month to UTC calendar bounds', () => {
    expect(windowFromMessage('How is my business performing this month?', now)).toEqual({
      range: 'custom',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-14T12:00:00.000Z',
    });
    expect(windowFromMessage("Compare last month's sales pipeline", now)).toEqual({
      range: 'custom',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
    });
  });

  it('calculates a finite percentage for a normal comparison', () => {
    expect(compareMetric(12, 8)).toEqual({
      current: 12,
      previous: 8,
      difference: 4,
      percentChange: 50,
      direction: 'up',
    });
    expect(rate(1, 4, 'converted leads').percent).toBe(25);
  });
});
