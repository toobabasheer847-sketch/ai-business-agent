import { BadRequestException } from '@nestjs/common';

import {
  resolveDashboardWindow,
  type DashboardWindow,
} from '../dashboard/dashboard-range.js';

export type AnalyticsComparison = {
  current: number;
  previous: number | null;
  difference: number | null;
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
};

export type AnalyticsRate = {
  numerator: number;
  denominator: number;
  percent: number | null;
  definition: string;
};

export function resolveAnalyticsWindow(
  input: { range?: string; from?: string; to?: string },
  now = new Date(),
): DashboardWindow {
  const range = input.range?.trim();
  if (!range) {
    return resolveDashboardWindow({ range: '30d' }, now);
  }
  if (range === 'lifetime') {
    throw new BadRequestException('Analytics range must be 7d, 30d, 90d, or custom.');
  }
  return resolveDashboardWindow(input, now);
}

export function previousWindow(window: DashboardWindow): DashboardWindow | null {
  if (!window.from || !window.to) return null;
  const duration = window.to.getTime() - window.from.getTime();
  if (!Number.isFinite(duration) || duration < 0) return null;
  const previousTo = new Date(window.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);
  if (Number.isNaN(previousFrom.getTime()) || Number.isNaN(previousTo.getTime())) return null;
  return {
    preset: window.preset,
    from: previousFrom,
    to: previousTo,
    timezone: 'UTC',
  };
}

export function windowFromMessage(message: string, now = new Date()): { range: '7d' | '30d' | '90d' | 'custom'; from?: string; to?: string } {
  const text = message.toLowerCase();
  if (/\b90 days\b/.test(text)) return { range: '90d' };
  if (/\b7 days\b|\blast week\b/.test(text)) return { range: '7d' };
  if (/\bthis month\b/.test(text)) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { range: 'custom', from: from.toISOString(), to: now.toISOString() };
  }
  if (/\blast month\b/.test(text)) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { range: 'custom', from: from.toISOString(), to: to.toISOString() };
  }
  return { range: '30d' };
}

export function compareMetric(current: number, previous: number | null): AnalyticsComparison {
  const safeCurrent = finiteNumber(current);
  if (previous === null || !Number.isFinite(previous)) {
    return {
      current: safeCurrent,
      previous: null,
      difference: null,
      percentChange: null,
      direction: 'unavailable',
    };
  }
  const safePrevious = previous;
  const difference = safeCurrent - safePrevious;
  return {
    current: safeCurrent,
    previous: safePrevious,
    difference,
    percentChange: safePrevious === 0 ? null : roundPercent((difference / safePrevious) * 100),
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
  };
}

export function rate(numerator: number, denominator: number, definition: string): AnalyticsRate {
  const safeNumerator = finiteNumber(numerator);
  const safeDenominator = finiteNumber(denominator);
  if (safeDenominator <= 0) {
    return { numerator: safeNumerator, denominator: 0, percent: null, definition };
  }
  return {
    numerator: safeNumerator,
    denominator: safeDenominator,
    percent: roundPercent((safeNumerator / safeDenominator) * 100),
    definition,
  };
}

export function assertFiniteMetric(value: number | null): void {
  if (value === null) return;
  if (!Number.isFinite(value)) {
    throw new Error('Metric was not a finite number.');
  }
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function roundPercent(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

export function windowLabel(window: DashboardWindow): string {
  if (!window.from || !window.to) return 'Lifetime';
  return `${window.from.toISOString()} to ${window.to.toISOString()} UTC`;
}
