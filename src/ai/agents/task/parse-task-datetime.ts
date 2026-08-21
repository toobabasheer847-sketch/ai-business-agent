/**
 * Natural-language due dates are interpreted in UTC, matching the existing
 * scheduler convention (`timeZone: 'UTC'`).
 *
 * Date-only phrases (today, tomorrow, next Monday, next week, YYYY-MM-DD)
 * become 00:00:00.000 UTC on that calendar day.
 *
 * When a time is present (3 PM, 10 AM, 3:30 PM, 15:00), it is applied as UTC
 * wall-clock time on the resolved day. Time-only phrases use today in UTC.
 *
 * Invalid or incomplete date/time phrases are rejected rather than guessed.
 */

export type ParseDueAtResult =
  | { status: 'none' }
  | { status: 'ok'; dueAt: Date; matchedText: string }
  | { status: 'invalid'; message: string };

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DATE_PHRASE_RE =
  /\b(?:today|tomorrow|next\s+week|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/i;

const TIME_PHRASE_RE =
  /\b(?:at\s+)?((?:[01]?\d|2[0-3]):[0-5]\d|(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?))\b/i;

const LOOSE_TIME_RE =
  /\b(?:at\s+)(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?|\d{1,2}:\d{2})\b/i;

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function isSameUtcDay(
  value: Date | string | null | undefined,
  day: Date,
): boolean {
  if (!value) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return startOfUtcDay(date).getTime() === startOfUtcDay(day).getTime();
}

export function utcDateAt(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
): Date {
  const date = new Date(Date.UTC(year, monthIndex, day, hours, minutes, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hours ||
    date.getUTCMinutes() !== minutes
  ) {
    throw new Error('Invalid date');
  }

  return date;
}

export function addUtcDays(from: Date, days: number): Date {
  return new Date(startOfUtcDay(from).getTime() + days * 24 * 60 * 60 * 1000);
}

export function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function parseClockTime(
  raw: string,
): { hours: number; minutes: number } | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '');

  const twentyFour = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) {
    return {
      hours: Number(twentyFour[1]),
      minutes: Number(twentyFour[2]),
    };
  }

  const twelve = normalized.match(/^(1[0-2]|0?[1-9])(?::([0-5]\d))?(am|pm)$/);
  if (!twelve) {
    return null;
  }

  let hours = Number(twelve[1]);
  const minutes = twelve[2] ? Number(twelve[2]) : 0;
  const meridiem = twelve[3];

  if (meridiem === 'am') {
    if (hours === 12) {
      hours = 0;
    }
  } else if (hours !== 12) {
    hours += 12;
  }

  return { hours, minutes };
}

function nextWeekday(from: Date, weekday: number): Date {
  const current = from.getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }

  return addUtcDays(from, delta);
}

function resolveDatePhrase(phrase: string, now: Date): Date | null {
  const lower = phrase.trim().toLowerCase();

  if (lower === 'today') {
    return startOfUtcDay(now);
  }

  if (lower === 'tomorrow') {
    return addUtcDays(now, 1);
  }

  if (lower === 'next week') {
    return addUtcDays(now, 7);
  }

  const nextDay = lower.match(
    /^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/,
  );
  if (nextDay) {
    return nextWeekday(now, WEEKDAYS[nextDay[1]]);
  }

  const iso = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    try {
      return utcDateAt(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    } catch {
      return null;
    }
  }

  return null;
}

function applyTime(date: Date, hours: number, minutes: number): Date {
  return utcDateAt(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes,
  );
}

export function stripDueDatePhrases(text: string): string {
  return text
    .replace(DATE_PHRASE_RE, ' ')
    .replace(TIME_PHRASE_RE, ' ')
    .replace(/\bon\s+/gi, ' ')
    .replace(/\bat\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTaskDueAt(
  text: string,
  now: Date = new Date(),
): ParseDueAtResult {
  const dateMatch = text.match(DATE_PHRASE_RE);
  const timeMatch = text.match(TIME_PHRASE_RE);
  const looseTime = text.match(LOOSE_TIME_RE);

  if (looseTime && !timeMatch) {
    return {
      status: 'invalid',
      message: `I could not understand the time "${looseTime[1]}". Please use a time like 3 PM, 10 AM, 3:30 PM, or 15:00.`,
    };
  }

  if (!dateMatch && !timeMatch) {
    return { status: 'none' };
  }

  let clock: { hours: number; minutes: number } | null = null;
  if (timeMatch) {
    clock = parseClockTime(timeMatch[1]);
    if (!clock) {
      return {
        status: 'invalid',
        message: `I could not understand the time "${timeMatch[1]}". Please use a time like 3 PM, 10 AM, 3:30 PM, or 15:00.`,
      };
    }
  }

  let day = startOfUtcDay(now);
  const matchedParts: string[] = [];

  if (dateMatch) {
    const resolved = resolveDatePhrase(dateMatch[0], now);
    if (!resolved) {
      return {
        status: 'invalid',
        message: `I could not understand the date "${dateMatch[0]}". Please use today, tomorrow, next week, next Monday, or YYYY-MM-DD.`,
      };
    }
    day = resolved;
    matchedParts.push(dateMatch[0]);
  }

  if (clock) {
    matchedParts.push(timeMatch![0]);
    return {
      status: 'ok',
      dueAt: applyTime(day, clock.hours, clock.minutes),
      matchedText: matchedParts.join(' '),
    };
  }

  return {
    status: 'ok',
    dueAt: day,
    matchedText: matchedParts.join(' '),
  };
}
