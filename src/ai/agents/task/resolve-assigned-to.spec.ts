import { BadRequestException } from '@nestjs/common';

import { resolveAssignedToForTenant } from './resolve-assigned-to';

describe('resolveAssignedToForTenant', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userB = '22222222-2222-4222-8222-222222222222';

  it('rejects assignment to a user outside the tenant', async () => {
    const userRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      resolveAssignedToForTenant(userRepository as any, userB, tenantA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an assignee in the same tenant', async () => {
    const userRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: userB,
        tenantId: tenantA,
      }),
    };

    await expect(
      resolveAssignedToForTenant(userRepository as any, userB, tenantA),
    ).resolves.toBe(userB);
  });
});
