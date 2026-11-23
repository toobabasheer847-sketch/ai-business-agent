import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { detectExceptions } from './exception-detect';
import {
  ExceptionLifecycle,
  parseExceptionQuery,
  type ExceptionStore,
} from './exception-lifecycle';
import type { ExceptionDraft, ExceptionRecord } from './exception.types';

class MemoryStore implements ExceptionStore {
  rows: ExceptionRecord[] = [];
  scans: unknown[] = [];
  members = new Set<string>(['tenant-a:user-a']);

  findByKey(tenantId: string, exceptionKey: string) {
    return Promise.resolve(
      this.rows.find(
        (row) => row.tenantId === tenantId && row.exceptionKey === exceptionKey,
      ) ?? null,
    );
  }

  insert(row: ExceptionRecord) {
    this.rows.push(row);
    return Promise.resolve(row);
  }

  save(row: ExceptionRecord) {
    const index = this.rows.findIndex(
      (item) => item.id === row.id && item.tenantId === row.tenantId,
    );
    this.rows[index] = row;
    return Promise.resolve(row);
  }

  list() {
    return Promise.resolve({ data: this.rows, total: this.rows.length });
  }

  summary() {
    return Promise.resolve({
      open: 0,
      critical: 0,
      high: 0,
      acknowledged: 0,
      resolved: 0,
      resolvedToday: 0,
      categories: {},
    });
  }

  find(tenantId: string, id: string) {
    return Promise.resolve(
      this.rows.find((row) => row.tenantId === tenantId && row.id === id) ??
        null,
    );
  }

  userInTenant(tenantId: string, userId: string) {
    return Promise.resolve(this.members.has(`${tenantId}:${userId}`));
  }

  openKeys(tenantId: string) {
    return Promise.resolve(
      this.rows
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            ['open', 'acknowledged', 'in_progress'].includes(row.status),
        )
        .map((row) => ({ id: row.id, exceptionKey: row.exceptionKey })),
    );
  }

  recordScan(input: unknown) {
    this.scans.push(input);
    return Promise.resolve();
  }
}

const now = new Date('2026-11-16T12:00:00.000Z');

function overdueDraft(): ExceptionDraft {
  return detectExceptions({
    now,
    truncated: false,
    tasks: [
      {
        id: 'task-1',
        title: 'Invoice',
        status: 'pending',
        priority: 'medium',
        dueAt: new Date('2026-11-14T12:00:00.000Z'),
        createdAt: new Date('2026-11-01T12:00:00.000Z'),
        assignedTo: 'user-a',
        assigneeActive: true,
        companyId: null,
      },
    ],
    leads: [],
    prospects: [],
    proposals: [],
    reminders: [],
    runs: [],
    approvals: [],
  })[0];
}

describe('ExceptionLifecycle', () => {
  it('creates one row and updates it on the next scan', async () => {
    const store = new MemoryStore();
    const lifecycle = new ExceptionLifecycle(store, () => now);
    const first = await lifecycle.apply('tenant-a', [overdueDraft()], true);
    const second = await lifecycle.apply('tenant-a', [overdueDraft()], true);
    expect(first).toEqual({ created: 1, updated: 0, resolved: 0 });
    expect(second).toEqual({ created: 0, updated: 1, resolved: 0 });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].occurrenceCount).toBe(2);
    expect(store.rows[0].tenantId).toBe('tenant-a');
  });

  it('does not expose or update another tenant row', async () => {
    const store = new MemoryStore();
    const lifecycle = new ExceptionLifecycle(store, () => now);
    await lifecycle.apply('tenant-a', [overdueDraft()], true);
    const other = await lifecycle.apply('tenant-b', [overdueDraft()], true);
    expect(other.created).toBe(1);
    expect(
      store.rows.filter((row) => row.tenantId === 'tenant-a'),
    ).toHaveLength(1);
    await expect(
      lifecycle.acknowledge('tenant-b', 'user-b', store.rows[0].id),
    ).rejects.toBeInstanceOf(Error);
  });

  it('resolves a cleared condition and leaves dismissed rows closed', async () => {
    const store = new MemoryStore();
    const lifecycle = new ExceptionLifecycle(store, () => now);
    await lifecycle.apply('tenant-a', [overdueDraft()], true);
    await lifecycle.dismiss(
      'tenant-a',
      'user-a',
      store.rows[0].id,
      'Not relevant',
    );
    const again = await lifecycle.apply('tenant-a', [overdueDraft()], true);
    expect(again).toEqual({ created: 0, updated: 0, resolved: 0 });
    expect(store.rows[0].status).toBe('dismissed');
  });

  it('auto-resolves an open exception whose source condition cleared', async () => {
    const store = new MemoryStore();
    const lifecycle = new ExceptionLifecycle(store, () => now);
    await lifecycle.apply('tenant-a', [overdueDraft()], true);
    const result = await lifecycle.apply('tenant-a', [], true);
    expect(result.resolved).toBe(1);
    expect(store.rows[0].status).toBe('resolved');
    expect(store.rows[0].resolutionNote).toBe('The source condition cleared.');
  });

  it('rejects assignment outside the tenant and illegal status moves', async () => {
    const store = new MemoryStore();
    const lifecycle = new ExceptionLifecycle(store, () => now);
    await lifecycle.apply('tenant-a', [overdueDraft()], false);
    const id = store.rows[0].id;
    await expect(
      lifecycle.assign('tenant-a', id, 'user-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await lifecycle.assign('tenant-a', id, 'user-a');
    expect(store.rows[0].assignedTo).toBe('user-a');
    await lifecycle.resolve('tenant-a', 'user-a', id, 'Done');
    await expect(
      lifecycle.changeStatus('tenant-a', 'user-a', id, 'in_progress'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an assignee filter that is not a UUID', () => {
    expect(() => parseExceptionQuery({ assignedTo: 'not-a-user' })).toThrow(
      BadRequestException,
    );
  });
});
