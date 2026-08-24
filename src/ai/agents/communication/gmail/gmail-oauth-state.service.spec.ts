import { BadRequestException } from '@nestjs/common';

import { GmailOauthStateService } from './gmail-oauth-state.service';

describe('GmailOauthStateService', () => {
  const insertValues = jest.fn();
  const insert = jest.fn(() => ({ values: insertValues }));
  const selectLimit = jest.fn();
  const select = jest.fn(() => ({
    from: () => ({
      where: () => ({
        limit: selectLimit,
      }),
    }),
  }));
  const updateReturning = jest.fn();
  const update = jest.fn(() => ({
    set: () => ({
      where: () => ({
        returning: updateReturning,
      }),
    }),
  }));

  const db = { insert, select, update };
  const service = new GmailOauthStateService(db as any);

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const userA = '22222222-2222-2222-2222-222222222222';
  const tenantB = '33333333-3333-3333-3333-333333333333';
  const userB = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => {
    jest.clearAllMocks();
    insertValues.mockResolvedValue(undefined);
  });

  it('creates an unpredictable state bound to the initiating tenant and user', async () => {
    const first = await service.create(tenantA, userA);
    const second = await service.create(tenantA, userA);

    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(first).not.toBe(second);
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(insertValues.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        tenantId: tenantA,
        userId: userA,
        purpose: 'gmail_oauth',
        state: first,
      }),
    );
    expect(insertValues.mock.calls[0][0].expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('consumes a valid unused state and returns the bound tenant/user', async () => {
    selectLimit.mockResolvedValue([
      {
        id: 'state-row-1',
        tenantId: tenantA,
        userId: userA,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    updateReturning.mockResolvedValue([
      { tenantId: tenantA, userId: userA },
    ]);

    await expect(service.consume('valid-state')).resolves.toEqual({
      tenantId: tenantA,
      userId: userA,
    });
  });

  it('rejects a missing state', async () => {
    await expect(service.consume(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.consume('')).rejects.toThrow('OAuth state is required');
  });

  it('rejects an invalid/unknown state', async () => {
    selectLimit.mockResolvedValue([]);

    await expect(service.consume('not-a-real-state')).rejects.toThrow(
      'Invalid OAuth state',
    );
  });

  it('rejects an expired state', async () => {
    selectLimit.mockResolvedValue([
      {
        id: 'state-row-1',
        tenantId: tenantA,
        userId: userA,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    await expect(service.consume('expired-state')).rejects.toThrow(
      'OAuth state has expired',
    );
    expect(updateReturning).not.toHaveBeenCalled();
  });

  it('rejects a replayed state', async () => {
    selectLimit.mockResolvedValue([
      {
        id: 'state-row-1',
        tenantId: tenantA,
        userId: userA,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    await expect(service.consume('replayed-state')).rejects.toThrow(
      'OAuth state has already been used',
    );
  });

  it('returns only the initiating tenant/user, never a different context', async () => {
    selectLimit.mockResolvedValue([
      {
        id: 'state-row-1',
        tenantId: tenantA,
        userId: userA,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    updateReturning.mockResolvedValue([
      { tenantId: tenantA, userId: userA },
    ]);

    const consumed = await service.consume('valid-state');

    expect(consumed).toEqual({ tenantId: tenantA, userId: userA });
    expect(consumed).not.toEqual({ tenantId: tenantB, userId: userB });
  });
});
