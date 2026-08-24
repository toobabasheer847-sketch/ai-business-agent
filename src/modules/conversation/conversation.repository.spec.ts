import { ConversationRepository } from './conversation.repository';

describe('ConversationRepository', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const conversationId = '33333333-3333-4333-8333-333333333333';

  function createRepository() {
    const findFirst = jest.fn();
    const limit = jest.fn();
    const orderBy = jest.fn();
    const where = jest.fn();
    const from = jest.fn();
    const select = jest.fn();
    const del = jest.fn();
    const update = jest.fn();
    const set = jest.fn();
    const insert = jest.fn();
    const values = jest.fn();
    const returning = jest.fn();

    const db = {
      insert,
      select,
      update,
      delete: del,
      query: {
        conversations: {
          findFirst,
        },
      },
    };

    insert.mockReturnValue({
      values: values.mockReturnValue({ returning }),
    });
    select.mockReturnValue({ from: from.mockReturnValue({ where }) });
    where.mockReturnValue({ orderBy });
    orderBy.mockReturnValue({ limit });
    update.mockReturnValue({
      set: set.mockReturnValue({ where }),
    });
    del.mockReturnValue({ where });

    const repository = new ConversationRepository(db as any);
    return {
      repository,
      findFirst,
      select,
      from,
      where,
      orderBy,
      limit,
      del,
    };
  }

  it('looks up assistant conversations by tenant and user ownership', async () => {
    const { repository, findFirst } = createRepository();
    findFirst.mockResolvedValue({
      id: conversationId,
      tenantId: tenantA,
      userId: userA,
      channel: 'assistant',
    });

    const row = await repository.findByIdTenantAndUser(
      conversationId,
      tenantA,
      userA,
    );

    expect(row?.tenantId).toBe(tenantA);
    expect(row?.userId).toBe(userA);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('does not return another user or tenant conversation', async () => {
    const { repository, findFirst } = createRepository();
    findFirst.mockResolvedValue(undefined);

    const missingUser = await repository.findByIdTenantAndUser(
      conversationId,
      tenantA,
      userB,
    );
    const missingTenant = await repository.findByIdTenantAndUser(
      conversationId,
      tenantB,
      userA,
    );

    expect(missingUser).toBeUndefined();
    expect(missingTenant).toBeUndefined();
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns recent messages oldest to newest and respects the limit', async () => {
    const { repository, limit, orderBy } = createRepository();
    const newest = {
      id: 'msg-2',
      content: 'newer',
      createdAt: new Date('2026-08-20T12:01:00Z'),
    };
    const oldest = {
      id: 'msg-1',
      content: 'older',
      createdAt: new Date('2026-08-20T12:00:00Z'),
    };
    limit.mockResolvedValue([newest, oldest]);

    const rows = await repository.findRecentMessages(
      conversationId,
      tenantA,
      20,
    );

    expect(limit).toHaveBeenCalledWith(20);
    expect(orderBy).toHaveBeenCalled();
    expect(rows).toEqual([oldest, newest]);
  });

  it('lists recent assistant conversations for the owning user with a limit', async () => {
    const { repository, limit } = createRepository();
    limit.mockResolvedValue([
      { id: conversationId, tenantId: tenantA, userId: userA },
    ]);

    const rows = await repository.findRecentByUser(tenantA, userA, 10);

    expect(limit).toHaveBeenCalledWith(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userA);
  });
});
