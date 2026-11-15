import { BadRequestException } from '@nestjs/common';

import { hasPermission, Permission } from '../../modules/authorization/permissions';
import type { MonitoringQuery, MonitoringScope, RunStatus } from './monitoring.types';

const STATUSES: RunStatus[] = ['running', 'completed', 'failed'];
const MAX_LIMIT = 100;

export function monitoringScope(input: { tenantId: string; userId: string; role?: string }): MonitoringScope {
  if (hasPermission(input.role, Permission.AuditView)) {
    return { tenantId: input.tenantId };
  }
  return { tenantId: input.tenantId, userId: input.userId };
}

export function canReadMonitoring(role?: string): boolean {
  return hasPermission(role, Permission.AuditView) || hasPermission(role, Permission.AssistantUse);
}

export function runMatchesScope(row: { tenantId: string; userId: string | null }, scope: MonitoringScope): boolean {
  if (row.tenantId !== scope.tenantId) return false;
  if (scope.userId && row.userId !== scope.userId) return false;
  return true;
}

export function parseMonitoringQuery(query: {
  page?: string;
  limit?: string;
  from?: string;
  to?: string;
  agent?: string;
  provider?: string;
  model?: string;
  status?: string;
  sort?: string;
  direction?: string;
}): MonitoringQuery {
  if (query.sort && query.sort !== 'startedAt') {
    throw new BadRequestException('Agent runs can only be sorted by startedAt.');
  }
  if (query.direction && query.direction !== 'desc') {
    throw new BadRequestException('Agent runs can only be sorted descending.');
  }
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 50;
  if (!Number.isInteger(page) || page < 1) throw new BadRequestException('page must be an integer of at least 1.');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException('limit must be an integer from 1 to 100.');
  }
  const status = query.status?.trim();
  if (status && !STATUSES.includes(status as RunStatus)) {
    throw new BadRequestException('status must be running, completed, or failed.');
  }
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    from: parseDate(query.from, 'from'),
    to: parseDate(query.to, 'to'),
    agent: bounded(query.agent, 80),
    provider: bounded(query.provider, 40),
    model: bounded(query.model, 120),
    status: status ? status as RunStatus : undefined,
  };
}

function bounded(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new BadRequestException('A filter value is too long.');
  return trimmed;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date = field === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid date.`);
  return date;
}
