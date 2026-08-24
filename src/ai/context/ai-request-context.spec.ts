import { UnauthorizedException } from '@nestjs/common';

import {
  getTrustedAiContext,
  runWithAiContext,
} from './ai-request-context';

describe('ai request context', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';

  it('binds tenantId and userId from JWT context only', async () => {
    await runWithAiContext({ tenantId: tenantA, userId: userA }, async () => {
      const trusted = getTrustedAiContext();
      expect(trusted.tenantId).toBe(tenantA);
      expect(trusted.userId).toBe(userA);
      expect(trusted.tenantId).not.toBe('other-tenant');
      expect(trusted.userId).not.toBe('other-user');
    });
  });

  it('distinguishes user A and user B within the same tenant', async () => {
    await runWithAiContext({ tenantId: tenantA, userId: userA }, async () => {
      expect(getTrustedAiContext().userId).toBe(userA);
    });

    await runWithAiContext({ tenantId: tenantA, userId: userB }, async () => {
      expect(getTrustedAiContext().userId).toBe(userB);
      expect(getTrustedAiContext().userId).not.toBe(userA);
    });
  });

  it('fails closed without trusted context', () => {
    expect(() => getTrustedAiContext()).toThrow(UnauthorizedException);
  });

  it('fails closed when tenantId or userId is missing', () => {
    expect(() =>
      runWithAiContext({ tenantId: '', userId: userA }, () => undefined),
    ).toThrow(UnauthorizedException);
    expect(() =>
      runWithAiContext({ tenantId: tenantA, userId: '' }, () => undefined),
    ).toThrow(UnauthorizedException);
  });
});
