import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UnauthorizedException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  const service = {
    overview: jest.fn(),
    salesPipeline: jest.fn(),
    tasksSummary: jest.fn(),
    recentActivity: jest.fn(),
    communicationsSummary: jest.fn(),
  };
  const controller = new DashboardController(service as any);
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires JWT and does not read a tenant id from the query', async () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController) ?? [];
    expect(guards).toContain(JwtAuthGuard);

    service.overview.mockResolvedValue({ lifetime: { companies: 1 } });
    await controller.overview(
      { user: { userId: 'user-1', tenantId, email: 'a@example.com', name: 'A' } } as any,
      { range: '7d', tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } as any,
    );

    expect(service.overview).toHaveBeenCalledWith(tenantId, {
      range: '7d',
      tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    const passedTenant = service.overview.mock.calls[0][0];
    expect(passedTenant).toBe(tenantId);
    expect(passedTenant).not.toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('rejects a request without an authenticated tenant', () => {
    expect(() => controller.overview({ user: undefined } as any, {})).toThrow(UnauthorizedException);
    expect(service.overview).not.toHaveBeenCalled();
  });
});
