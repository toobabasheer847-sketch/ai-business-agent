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

  it('parses next Tuesday as the following Tuesday in UTC', () => {
    const result = parseTaskDueAt('Create a task next Tuesday', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-25T00:00:00.000Z');
    }
  });

  it('parses an explicit YYYY-MM-DD date', () => {
    const result = parseTaskDueAt('Create a task on 2026-09-01', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    }
  });

  it('parses next Monday at 10 AM as 10:00 UTC', () => {
    const result = parseTaskDueAt(
      'Create a task next Monday at 10 AM',
      now,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-24T10:00:00.000Z');
    }
  });

  it('parses a time-only phrase against today in UTC', () => {
    const result = parseTaskDueAt('Remind me at 3 PM', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-20T15:00:00.000Z');
    }
  });

  it('keeps date-only behavior for sometime tomorrow', () => {
    const result = parseTaskDueAt('remind me sometime tomorrow', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-21T00:00:00.000Z');
    }
  });

  it('keeps next week as seven UTC days later', () => {
    const result = parseTaskDueAt('remind me next week', now);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.dueAt.toISOString()).toBe('2026-08-27T00:00:00.000Z');
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
