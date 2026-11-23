import { ServiceUnavailableException } from '@nestjs/common';

import { ExceptionProcessor } from './exception.processor';
import { ExceptionScheduler } from './exception.scheduler';
import { ExceptionService } from './exception.service';
import type { DetectionSnapshot } from './exception.types';

const snapshot: DetectionSnapshot = {
  now: new Date('2026-11-16T12:00:00.000Z'),
  truncated: false,
  tasks: [
    {
      id: 'task-1',
      title: 'Invoice',
      status: 'pending',
      priority: 'medium',
      dueAt: new Date('2026-11-14T12:00:00.000Z'),
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
      assignedTo: null,
      assigneeActive: null,
      companyId: null,
    },
  ],
  leads: [],
  prospects: [],
  proposals: [],
  reminders: [],
  runs: [],
  approvals: [],
};

function harness(redis = '') {
  const rows = new Map<
    string,
    { exceptionKey: string; tenantId: string; status: string; id: string }
  >();
  const store = {
    findByKey: jest.fn((tenantId: string, key: string) =>
      Promise.resolve(
        [...rows.values()].find(
          (row) => row.tenantId === tenantId && row.exceptionKey === key,
        ) ?? null,
      ),
    ),
    insert: jest.fn(
      (row: {
        id: string;
        tenantId: string;
        exceptionKey: string;
        status: string;
      }) => {
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
    ),
    save: jest.fn(
      (row: {
        id: string;
        tenantId: string;
        exceptionKey: string;
        status: string;
      }) => {
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
    ),
    find: jest.fn((tenantId: string, id: string) =>
      Promise.resolve(
        [...rows.values()].find(
          (row) => row.tenantId === tenantId && row.id === id,
        ) ?? null,
      ),
    ),
    openKeys: jest.fn((tenantId: string) =>
      Promise.resolve(
        [...rows.values()]
          .filter((row) => row.tenantId === tenantId && row.status === 'open')
          .map((row) => ({ id: row.id, exceptionKey: row.exceptionKey })),
      ),
    ),
    recordScan: jest.fn(),
    list: jest.fn(),
    summary: jest.fn(),
    attention: jest.fn(),
    userInTenant: jest.fn(),
  };
  const source = {
    load: jest.fn(() => Promise.resolve(snapshot)),
    listTenantIds: jest.fn(() => Promise.resolve(['tenant-a', 'tenant-b'])),
  };
  const added: Array<{ attempts: number; jobId: string }> = [];
  const queue = {
    add: jest.fn(
      (
        _name: string,
        _data: { tenantId: string },
        options: { attempts: number; jobId: string },
      ) => {
        added.push(options);
        return Promise.resolve();
      },
    ),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'REDIS_URL' ? redis : undefined)),
  };
  const service = new ExceptionService(
    store as never,
    source as never,
    config as never,
    queue as never,
  );
  return { service, store, source, queue, added };
}

describe('ExceptionService', () => {
  it('records a failed scan and rethrows the detection error', async () => {
    const { service, source, store } = harness();
    source.load.mockRejectedValue(new Error('database timeout'));
    await expect(service.detect('tenant-a')).rejects.toThrow(
      'database timeout',
    );
    expect(store.recordScan).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorSummary: 'database timeout',
      }),
    );
  });

  it('reports that detection does not send messages', async () => {
    const { service } = harness();
    const result = await service.detect('tenant-a');
    expect(result).toMatchObject({ created: 1, sendsMessages: false });
  });

  it('shares one in-flight scan for the same tenant', async () => {
    const { service, source } = harness();
    let release: () => void = () => undefined;
    source.load.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(snapshot);
        }),
    );
    const first = service.detect('tenant-a');
    const second = service.detect('tenant-a');
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.anything(),
      expect.anything(),
    ]);
    expect(source.load).toHaveBeenCalledTimes(1);
  });

  it('refuses the schedule when Redis is not configured', async () => {
    const { service } = harness('');
    await expect(service.enqueueAll()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('enqueues one job per tenant when Redis is configured', async () => {
    const { service, added } = harness('redis://127.0.0.1:6379');
    await expect(service.enqueueAll()).resolves.toEqual({ queued: 2 });
    expect(added).toHaveLength(2);
    expect(added[0].attempts).toBe(3);
    expect(added[0].jobId).toContain('exception-scan:tenant-a:');
  });

  it('keeps queuing later tenants when one enqueue fails', async () => {
    const { service, queue } = harness('redis://127.0.0.1:6379');
    queue.add
      .mockRejectedValueOnce(new Error('redis timeout'))
      .mockResolvedValueOnce(undefined);
    await expect(service.enqueueAll()).resolves.toEqual({ queued: 1 });
  });

  it('labels a detail suggestion as a rule, separate from the detected facts', async () => {
    const { service, store } = harness();
    await service.detect('tenant-a');
    const inserted = store.insert.mock.calls[0]?.[0] as { id: string };
    const id = inserted.id;
    const detail = await service.detail('tenant-a', id);
    expect(detail.suggestionSource).toBe('rule');
    expect(detail.suggestion).toContain('Review the task');
    expect(detail.evidence).toContain('overdue');
  });

  it('does not auto-resolve when a source query hits its limit', async () => {
    const { service, source, store } = harness();
    await service.detect('tenant-a');
    store.openKeys.mockClear();
    source.load.mockResolvedValue({ ...snapshot, tasks: [], truncated: true });
    await expect(service.detect('tenant-a')).resolves.toMatchObject({
      resolved: 0,
      truncated: true,
    });
    expect(store.openKeys).not.toHaveBeenCalled();
  });
});

describe('ExceptionProcessor', () => {
  it('runs a scheduled scan for the job tenant only', async () => {
    const exceptions = { detect: jest.fn() };
    const processor = new ExceptionProcessor(exceptions as never);
    await processor.process({
      name: 'scan-tenant',
      data: { tenantId: 'tenant-a' },
    } as never);
    expect(exceptions.detect).toHaveBeenCalledWith('tenant-a', 'schedule');
  });
});

describe('ExceptionScheduler', () => {
  it('logs an operational error and does not enqueue when Redis is missing', async () => {
    const exceptions = {
      schedulerAvailable: () => false,
      enqueueAll: jest.fn(),
    };
    const logger = { log: jest.fn(), error: jest.fn() };
    const scheduler = new ExceptionScheduler(
      exceptions as never,
      { get: () => 'true' } as never,
      logger as never,
    );
    await scheduler.handle();
    expect(exceptions.enqueueAll).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL is not configured'),
      undefined,
      expect.anything(),
      expect.anything(),
    );
  });
});
