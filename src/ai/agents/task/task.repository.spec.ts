import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';

  function createRepository() {
    const limit = jest.fn().mockResolvedValue([]);
    const orderBy = jest.fn().mockResolvedValue([]);
    const returning = jest.fn().mockResolvedValue([]);
    const where = jest.fn();
    const from = jest.fn();
    const select = jest.fn();
    const del = jest.fn();
    const set = jest.fn();
    const update = jest.fn();
    const insert = jest.fn();
    const values = jest.fn();
    const leftJoin = jest.fn();

    where.mockImplementation(() => ({
      orderBy,
      limit,
      returning,
    }));

    const joined = { leftJoin, where };
    leftJoin.mockReturnValue(joined);

    const db = {
      insert,
      select,
      update,
      delete: del,
    };

    insert.mockReturnValue({
      values: values.mockReturnValue({ returning }),
    });
    select.mockReturnValue({ from: from.mockReturnValue(joined) });
    update.mockReturnValue({
      set: set.mockReturnValue({ where }),
    });
    del.mockReturnValue({ where });

    return {
      repository: new TaskRepository(db as any),
      select,
      where,
      limit,
      orderBy,
      del,
      set,
      values,
      returning,
    };
  }

  it('looks up tasks by tenant and user access', async () => {
    const { repository, limit, where } = createRepository();
    limit.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        title: 'Call Ahmed',
        status: 'pending',
        priority: 'medium',
      },
    ]);

    const row = await repository.findByIdAndTenantAndUser(
      taskId,
      tenantA,
      userA,
    );

    expect(where).toHaveBeenCalled();
    expect(row?.tenantId).toBe(tenantA);
    expect(row?.createdBy).toBe(userA);
  });

  it('does not return another tenant or private user task', async () => {
    const { repository, limit } = createRepository();
    limit.mockResolvedValue([]);

    const missingTenant = await repository.findByIdAndTenantAndUser(
      taskId,
      tenantB,
      userA,
    );
    const missingUser = await repository.findByIdAndTenantAndUser(
      taskId,
      tenantA,
      userB,
    );

    expect(missingTenant).toBeNull();
    expect(missingUser).toBeNull();
  });

  it('lists tasks through the tenant+user access filter', async () => {
    const { repository, orderBy, where } = createRepository();
    orderBy.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: userB,
        title: 'Follow up',
        status: 'pending',
        priority: 'high',
      },
    ]);

    const rows = await repository.findAllByTenantAndUserAndStatus(
      tenantA,
      userB,
      'pending',
    );

    expect(where).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0].assignedTo).toBe(userB);
  });

  it('creates a task with optional CRM foreign keys', async () => {
    const { repository, values, returning, limit } = createRepository();
    returning.mockResolvedValue([{ id: taskId }]);
    limit.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        companyId: 'c1',
        prospectId: null,
        leadId: null,
        title: 'Follow up',
        status: 'pending',
        priority: 'medium',
        companyName: 'ABC Technologies',
      },
    ]);

    const row = await repository.createTask({
      tenantId: tenantA,
      createdBy: userA,
      title: 'Follow up',
      companyId: 'c1',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        companyId: 'c1',
        prospectId: null,
        leadId: null,
      }),
    );
    expect(row.companyId).toBe('c1');
    expect(row.company).toEqual({ id: 'c1', name: 'ABC Technologies' });
  });

  it('creates a task with a prospect foreign key', async () => {
    const { repository, values, returning, limit } = createRepository();
    returning.mockResolvedValue([{ id: taskId }]);
    limit.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        companyId: null,
        prospectId: 'p1',
        leadId: null,
        title: 'Follow up',
        status: 'pending',
        priority: 'medium',
        prospectFirstName: 'Ahmed',
        prospectLastName: 'Khan',
      },
    ]);

    const row = await repository.createTask({
      tenantId: tenantA,
      createdBy: userA,
      title: 'Follow up',
      prospectId: 'p1',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ prospectId: 'p1', companyId: null, leadId: null }),
    );
    expect(row.prospectId).toBe('p1');
    expect(row.prospect).toEqual({ id: 'p1', name: 'Ahmed Khan', email: null });
  });

  it('creates a task with a lead foreign key', async () => {
    const { repository, values, returning, limit } = createRepository();
    returning.mockResolvedValue([{ id: taskId }]);
    limit.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        companyId: null,
        prospectId: null,
        leadId: 'l1',
        title: 'Follow up',
        status: 'pending',
        priority: 'medium',
        leadFirstName: 'Zainab',
        leadLastName: 'Ali',
      },
    ]);

    const row = await repository.createTask({
      tenantId: tenantA,
      createdBy: userA,
      title: 'Follow up',
      leadId: 'l1',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'l1', companyId: null, prospectId: null }),
    );
    expect(row.leadId).toBe('l1');
    expect(row.lead).toEqual({ id: 'l1', name: 'Zainab Ali', email: null });
  });

  it('updates and retrieves a CRM relationship', async () => {
    const { repository, set, returning, limit } = createRepository();
    returning.mockResolvedValue([{ id: taskId }]);
    limit.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        companyId: 'c2',
        prospectId: null,
        leadId: null,
        title: 'Follow up',
        status: 'pending',
        priority: 'medium',
        companyName: 'ABC UniqueCo',
      },
    ]);

    const row = await repository.updateTask(taskId, tenantA, userA, {
      companyId: 'c2',
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c2' }),
    );
    expect(row?.companyId).toBe('c2');
    expect(row?.company).toEqual({ id: 'c2', name: 'ABC UniqueCo' });
  });

  it('lists tasks with joined CRM information', async () => {
    const { repository, orderBy } = createRepository();
    orderBy.mockResolvedValue([
      {
        id: taskId,
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: null,
        companyId: 'c1',
        prospectId: 'p1',
        leadId: null,
        title: 'Follow up',
        status: 'pending',
        priority: 'medium',
        companyName: 'ABC Technologies',
        prospectFirstName: 'Ahmed',
        prospectLastName: 'Khan',
      },
    ]);

    const rows = await repository.findAllByTenantAndUser(tenantA, userA);

    expect(rows).toHaveLength(1);
    expect(rows[0].company).toEqual({ id: 'c1', name: 'ABC Technologies' });
    expect(rows[0].prospect).toEqual({
      id: 'p1',
      name: 'Ahmed Khan',
      email: null,
    });
  });

  it('lists through company, prospect, and lead filters without dropping the access clause', async () => {
    const { repository, where, orderBy } = createRepository();
    orderBy.mockResolvedValue([]);

    await repository.findAllByTenantAndUser(tenantA, userA, {
      companyId: 'c1',
    });
    await repository.findAllByTenantAndUser(tenantA, userA, {
      prospectId: 'p1',
    });
    await repository.findAllByTenantAndUser(tenantA, userA, {
      leadId: 'l1',
    });
    await repository.findAllByTenantAndUser(tenantA, userA, {
      companyId: 'c1',
      prospectId: 'p1',
      leadId: 'l1',
    });
    await repository.findAllByTenantAndUser(tenantA, userA);

    expect(where).toHaveBeenCalledTimes(5);
  });

  it('lists overdue tasks without dropping the access clause', async () => {
    const { repository, where, orderBy } = createRepository();
    orderBy.mockResolvedValue([]);

    await repository.findAllByTenantAndUser(tenantA, userA, { overdue: true });
    await repository.findAllByTenantAndUser(tenantA, userA, {
      dueFrom: '2026-08-20T00:00:00.000Z',
      dueTo: '2026-08-20T23:59:59.999Z',
    });

    expect(where).toHaveBeenCalledTimes(2);
  });
});
