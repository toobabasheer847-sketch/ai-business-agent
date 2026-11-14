import { BadRequestException } from '@nestjs/common';

import { endOfUtcDay, startOfUtcDay, startOfUtcWeek } from '../../ai/agents/task/parse-task-datetime.js';

export type DashboardPreset = 'lifetime' | '7d' | '30d' | '90d' | 'custom';

export type DashboardWindow = {
  preset: DashboardPreset;
  from: Date | null;
  to: Date | null;
  timezone: 'UTC';
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveDashboardWindow(
  input: { range?: string; from?: string; to?: string },
  now = new Date(),
): DashboardWindow {
  const range = input.range?.trim() || 'lifetime';

  if (range === 'lifetime') {
    return { preset: 'lifetime', from: null, to: null, timezone: 'UTC' };
  }

  if (range === '7d' || range === '30d' || range === '90d') {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return {
      preset: range,
      from: new Date(now.getTime() - days * DAY_MS),
      to: now,
      timezone: 'UTC',
    };
  }

  if (range === 'custom') {
    if (!input.from || !input.to) {
      throw new BadRequestException('Custom range requires from and to.');
    }
    const from = parseUtcBound(input.from, 'start');
    const to = parseUtcBound(input.to, 'end');
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Custom range from must be before to.');
    }
    return { preset: 'custom', from, to, timezone: 'UTC' };
  }

  throw new BadRequestException('Range must be 7d, 30d, 90d, custom, or omitted.');
}

export function isOpenOverdueTask(
  status: string,
  dueAt: Date | string | null | undefined,
  now: Date,
): boolean {
  if (status === 'completed' || status === 'cancelled' || !dueAt) {
    return false;
  }
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

export function currentTaskWindows(now = new Date()): { todayStart: Date; todayEnd: Date; weekStart: Date; weekEnd: Date } {
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);
  const weekEnd = endOfUtcDay(new Date(weekStart.getTime() + 6 * DAY_MS));
  return { todayStart, todayEnd, weekStart, weekEnd };
}

function parseUtcBound(value: string, edge: 'start' | 'end'): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(utc.getTime())) {
      throw new BadRequestException('Invalid date.');
    }
    return edge === 'start' ? startOfUtcDay(utc) : endOfUtcDay(utc);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date.');
  }
  return parsed;
}
