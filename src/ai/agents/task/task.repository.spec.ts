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

    where.mockImplementation(() => ({
      orderBy,
      limit,
      returning,
    }));

    const db = {
      insert,
      select,
      update,
      delete: del,
    };

    insert.mockReturnValue({
      values: values.mockReturnValue({ returning }),
    });
    select.mockReturnValue({ from: from.mockReturnValue({ where }) });
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
});
