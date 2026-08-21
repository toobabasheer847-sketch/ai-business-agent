import { UnauthorizedException } from '@nestjs/common';

import {
  getTrustedTaskContext,
  runWithTaskContext,
} from './task-request-context';

describe('task request context', () => {
  const context = {
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: '11111111-1111-4111-8111-111111111111',
  };

  it('ignores model-supplied tenant identity and uses the trusted store', async () => {
    await runWithTaskContext(context, async () => {
      const trusted = getTrustedTaskContext();
      const modelTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      expect(trusted.tenantId).toBe(context.tenantId);
      expect(trusted.tenantId).not.toBe(modelTenantId);
      expect(trusted.userId).toBe(context.userId);
    });
  });

  it('fails closed when ADK tools run without JWT context', () => {
    expect(() => getTrustedTaskContext()).toThrow(UnauthorizedException);
  });
});
