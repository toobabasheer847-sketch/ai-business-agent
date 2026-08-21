import {
  parseClockTime,
  parseTaskDueAt,
  startOfUtcDay,
} from './parse-task-datetime';

describe('parseTaskDueAt', () => {
  const now = new Date('2026-08-20T12:00:00.000Z'); // Thursday

  it('parses today as the UTC start of the current day', () => {
    const result = parseTaskDueAt('Show my tasks for today', now);

    expect(result).toEqual({
      status: 'ok',
      dueAt: new Date('2026-08-20T00:00:00.000Z'),
      matchedText: 'today',
    });
  });

  it('parses tomorrow as the UTC start of the next day', () => {
    const result = parseTaskDueAt('Create a task to call Ahmed tomorrow.', now);

    expect(result).toEqual({
      status: 'ok',
      dueAt: new Date('2026-08-21T00:00:00.000Z'),
      matchedText: 'tomorrow',
    });
  });

  it('parses next Monday as the following Monday in UTC', () => {
    const result = parseTaskDueAt('New task: follow up with ABC next Monday.', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    }
  });

  it('parses tomorrow at 3 PM as 15:00 UTC', () => {
    const result = parseTaskDueAt('Create a task to call Ahmed tomorrow at 3 PM', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-21T15:00:00.000Z');
    }
  });

  it('parses 10 AM, 3:30 PM, and 15:00', () => {
    expect(parseClockTime('10 AM')).toEqual({ hours: 10, minutes: 0 });
    expect(parseClockTime('3:30 PM')).toEqual({ hours: 15, minutes: 30 });
    expect(parseClockTime('15:00')).toEqual({ hours: 15, minutes: 0 });
  });

  it('rejects an invalid time instead of guessing', () => {
    const result = parseTaskDueAt(
      'Create a task to call Ahmed tomorrow at 25:00',
      now,
    );

    expect(result.status).toBe('invalid');
  });

  it('rejects an invalid calendar date', () => {
    const result = parseTaskDueAt('Create a task to call Ahmed on 2026-13-99', now);

    expect(result.status).toBe('invalid');
  });

  it('returns none when no date phrase is present', () => {
    expect(parseTaskDueAt('Create a task to call Ahmed', now)).toEqual({
      status: 'none',
    });
  });

  it('uses UTC start-of-day for date-only values', () => {
    expect(startOfUtcDay(now).toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });
});
