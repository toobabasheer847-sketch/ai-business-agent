import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { priorityFor } from './exception-detect';
import {
  EXCEPTION_CATEGORIES,
  EXCEPTION_SEVERITIES,
  EXCEPTION_STATUSES,
  OPEN_STATUSES,
  type ExceptionDraft,
  type ExceptionQuery,
  type ExceptionRecord,
  type ExceptionStatus,
} from './exception.types';

export type ExceptionStore = {
  findByKey(
    tenantId: string,
    exceptionKey: string,
  ): Promise<ExceptionRecord | null>;
  insert(row: ExceptionRecord): Promise<ExceptionRecord>;
  save(row: ExceptionRecord): Promise<ExceptionRecord>;
  list(
    tenantId: string,
    query: ExceptionQuery,
  ): Promise<{ data: ExceptionRecord[]; total: number }>;
  summary(tenantId: string, now: Date): Promise<ExceptionSummary>;
  find(tenantId: string, id: string): Promise<ExceptionRecord | null>;
  userInTenant(tenantId: string, userId: string): Promise<boolean>;
  openKeys(
    tenantId: string,
  ): Promise<Array<{ id: string; exceptionKey: string }>>;
  recordScan(input: ScanRecord): Promise<void>;
};

export type ScanRecord = {
  tenantId: string;
  trigger: 'manual' | 'schedule';
  status: 'completed' | 'failed';
  startedAt: Date;
  finishedAt: Date;
  createdCount: number;
  updatedCount: number;
  resolvedCount: number;
  errorSummary: string | null;
};

export type ExceptionSummary = {
  open: number;
  critical: number;
  high: number;
  acknowledged: number;
  resolved: number;
  resolvedToday: number;
  categories: Record<string, number>;
};

const TRANSITIONS: Record<ExceptionStatus, ExceptionStatus[]> = {
  open: ['acknowledged', 'in_progress', 'resolved', 'dismissed'],
  acknowledged: ['in_progress', 'resolved', 'dismissed'],
  in_progress: ['acknowledged', 'resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

export class ExceptionLifecycle {
  constructor(
    private readonly store: ExceptionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async apply(
    tenantId: string,
    drafts: ExceptionDraft[],
    autoResolve: boolean,
  ): Promise<{ created: number; updated: number; resolved: number }> {
    let created = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const draft of drafts) {
      seen.add(draft.exceptionKey);
      const existing = await this.store.findByKey(tenantId, draft.exceptionKey);
      if (!existing) {
        await this.store.insert(this.fresh(tenantId, draft));
        created += 1;
        continue;
      }
      if (existing.status === 'dismissed' || existing.status === 'resolved')
        continue;
      const occurrenceCount = existing.occurrenceCount + 1;
      const priority = priorityFor(
        draft,
        occurrenceCount,
        existing.acknowledgedAt != null,
      );
      await this.store.save({
        ...existing,
        ...draft,
        occurrenceCount,
        priorityScore: priority.score,
        priorityReason: priority.reason,
        lastDetectedAt: this.now(),
        updatedAt: this.now(),
      });
      updated += 1;
    }
    let resolved = 0;
    if (autoResolve) {
      const open = await this.store.openKeys(tenantId);
      for (const row of open) {
        if (seen.has(row.exceptionKey)) continue;
        const current = await this.store.find(tenantId, row.id);
        if (!current || !OPEN_STATUSES.includes(current.status)) continue;
        await this.store.save({
          ...current,
          status: 'resolved',
          resolvedAt: this.now(),
          resolutionNote: 'The source condition cleared.',
          updatedAt: this.now(),
        });
        resolved += 1;
      }
    }
    return { created, updated, resolved };
  }

  async acknowledge(tenantId: string, userId: string, id: string) {
    const row = await this.require(tenantId, id);
    this.assertTransition(row.status, 'acknowledged');
    return this.store.save({
      ...row,
      status: 'acknowledged',
      acknowledgedAt: this.now(),
      acknowledgedBy: userId,
      updatedAt: this.now(),
    });
  }

  async assign(tenantId: string, id: string, userId: string) {
    if (!(await this.store.userInTenant(tenantId, userId))) {
      throw new ForbiddenException('That user is not in this tenant.');
    }
    const row = await this.require(tenantId, id);
    if (!OPEN_STATUSES.includes(row.status))
      throw new ConflictException('This exception can no longer be assigned.');
    return this.store.save({
      ...row,
      assignedTo: userId,
      updatedAt: this.now(),
    });
  }

  async changeStatus(
    tenantId: string,
    userId: string,
    id: string,
    status: ExceptionStatus,
  ) {
    if (status !== 'acknowledged' && status !== 'in_progress') {
      throw new BadRequestException(
        'Status can move to acknowledged or in_progress from this endpoint.',
      );
    }
    const row = await this.require(tenantId, id);
    this.assertTransition(row.status, status);
    return this.store.save({
      ...row,
      status,
      acknowledgedAt:
        status === 'acknowledged' ? this.now() : row.acknowledgedAt,
      acknowledgedBy: status === 'acknowledged' ? userId : row.acknowledgedBy,
      updatedAt: this.now(),
    });
  }

  async resolve(tenantId: string, userId: string, id: string, note?: string) {
    const row = await this.require(tenantId, id);
    this.assertTransition(row.status, 'resolved');
    return this.store.save({
      ...row,
      status: 'resolved',
      resolvedAt: this.now(),
      resolvedBy: userId,
      resolutionNote: clip(note, 500),
      updatedAt: this.now(),
    });
  }

  async dismiss(tenantId: string, userId: string, id: string, reason: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 3)
      throw new BadRequestException('A dismissal reason is required.');
    const row = await this.require(tenantId, id);
    this.assertTransition(row.status, 'dismissed');
    return this.store.save({
      ...row,
      status: 'dismissed',
      dismissedAt: this.now(),
      dismissedBy: userId,
      resolutionNote: clip(trimmed, 500),
      updatedAt: this.now(),
    });
  }

  private fresh(tenantId: string, draft: ExceptionDraft): ExceptionRecord {
    const now = this.now();
    const priority = priorityFor(draft, 1, false);
    return {
      ...draft,
      id: randomUUID(),
      tenantId,
      status: 'open',
      detectedAt: now,
      lastDetectedAt: now,
      occurrenceCount: 1,
      priorityScore: priority.score,
      priorityReason: priority.reason,
      assignedTo: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      dismissedAt: null,
      dismissedBy: null,
      resolutionNote: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async require(tenantId: string, id: string) {
    const row = await this.store.find(tenantId, id);
    if (!row || row.tenantId !== tenantId)
      throw new NotFoundException('Exception not found.');
    return row;
  }

  private assertTransition(from: ExceptionStatus, to: ExceptionStatus) {
    if (!TRANSITIONS[from].includes(to)) {
      throw new ConflictException(
        `Cannot move an exception from ${from} to ${to}.`,
      );
    }
  }
}

export function parseExceptionQuery(query: {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  severity?: string;
  status?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  sort?: string;
}): ExceptionQuery {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;
  if (!Number.isInteger(page) || page < 1)
    throw new BadRequestException('page must be an integer of at least 1.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new BadRequestException('limit must be an integer from 1 to 100.');
  const sort = query.sort?.trim() || 'priority';
  if (sort !== 'priority' && sort !== 'detectedAt')
    throw new BadRequestException('sort must be priority or detectedAt.');
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    search: bounded(query.search, 80),
    category: oneOf(query.category, EXCEPTION_CATEGORIES, 'category'),
    severity: oneOf(query.severity, EXCEPTION_SEVERITIES, 'severity'),
    status: oneOf(query.status, EXCEPTION_STATUSES, 'status'),
    assignedTo: parseUuid(query.assignedTo, 'assignedTo'),
    from: parseDate(query.from, 'from'),
    to: parseDate(query.to, 'to'),
    sort,
  };
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!allowed.includes(trimmed as T))
    throw new BadRequestException(`${field} is not supported.`);
  return trimmed as T;
}

function parseUuid(value: string | undefined, field: string) {
  const trimmed = bounded(value, 80);
  if (!trimmed) return undefined;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  ) {
    throw new BadRequestException(`${field} must be a UUID.`);
  }
  return trimmed;
}

function bounded(value: string | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max)
    throw new BadRequestException('A filter value is too long.');
  return trimmed;
}

function parseDate(value: string | undefined, field: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date =
    field === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T23:59:59.999Z`)
      : new Date(trimmed);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${field} must be a valid date.`);
  return date;
}

function clip(value: string | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
