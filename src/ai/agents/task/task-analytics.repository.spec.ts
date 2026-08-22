import { TaskAnalyticsRepository } from './task-analytics.repository';

describe('TaskAnalyticsRepository', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2026-08-22T12:00:00.000Z');

  function createRepository(summaryRow?: Record<string, unknown>) {
    const chain: any = {};
    const select = jest.fn();
    const from = jest.fn();
    const innerJoin = jest.fn();
    const where = jest.fn();
    const groupBy = jest.fn();

    chain.from = from;
    chain.innerJoin = innerJoin;
    chain.where = where;
    chain.groupBy = groupBy;
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve([summaryRow ?? {}]).then(resolve, reject);

    from.mockReturnValue(chain);
    innerJoin.mockReturnValue(chain);
    where.mockReturnValue(chain);
    groupBy.mockResolvedValue([]);
    select.mockReturnValue(chain);

    const db = { select };
    return {
      repository: new TaskAnalyticsRepository(db as any),
      select,
      where,
      groupBy,
    };
  }

  it('aggregates status, priority, overdue, and due windows without loading every task', async () => {
    const { repository, select, where } = createRepository({
      total: 20,
      pending: 8,
      inProgress: 3,
      completed: 7,
      cancelled: 2,
      overdue: 4,
      dueToday: 3,
      dueTomorrow: 2,
      highPriorityOpen: 4,
      urgentOpen: 1,
      low: 2,
      medium: 10,
      high: 6,
      urgent: 2,
      company: 8,
      prospect: 5,
      lead: 4,
      unlinked: 3,
      scheduled: 5,
      processing: 0,
      sent: 8,
      failed: 1,
      disabled: 3,
    });

    const result = await repository.getSummary(tenantA, userA, {}, now);

    expect(select).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(result.summary.total).toBe(20);
    expect(result.summary.pending).toBe(8);
    expect(result.summary.inProgress).toBe(3);
    expect(result.summary.completed).toBe(7);
    expect(result.summary.cancelled).toBe(2);
    expect(result.summary.overdue).toBe(4);
    expect(result.summary.dueToday).toBe(3);
    expect(result.summary.dueTomorrow).toBe(2);
    expect(result.priority.high).toBe(6);
    expect(result.crm.company).toBe(8);
    expect(result.reminders.scheduled).toBe(5);
    expect(result.reminders.sent).toBe(8);
    expect(result.reminders.failed).toBe(1);
    expect(result.completionRate).toBe(35);
    expect(result.overdueRate).toBe(20);
  });

  it('returns zero-task analytics', async () => {
    const { repository } = createRepository({
      total: 0,
      pending: 0,
      completed: 0,
      overdue: 0,
    });

    const result = await repository.getSummary(tenantA, userA, {}, now);
    expect(result.summary.total).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.overdueRate).toBe(0);
  });

  it('applies tenant and user access on analytics queries', async () => {
    const { repository, where } = createRepository({ total: 1 });

    await repository.getSummary(tenantA, userA, {}, now);
    expect(where).toHaveBeenCalled();

    await repository.getSummary(tenantB, userB, {}, now);
    expect(where).toHaveBeenCalled();
  });

  it('groups trends by day using aggregation', async () => {
    const { repository, groupBy } = createRepository();
    groupBy.mockResolvedValue([
      { period: new Date('2026-08-22T00:00:00.000Z'), count: 5 },
    ]);

    const trends = await repository.getTrends(
      tenantA,
      userA,
      {},
      'day',
      new Date('2026-08-22T00:00:00.000Z'),
      new Date('2026-08-22T23:59:59.999Z'),
      now,
    );

    expect(groupBy).toHaveBeenCalled();
    expect(trends).toEqual([
      { period: '2026-08-22', created: 5, completed: 5, overdue: 5 },
    ]);
  });
});
