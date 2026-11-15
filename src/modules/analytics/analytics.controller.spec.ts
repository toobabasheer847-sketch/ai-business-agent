import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UnauthorizedException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  const service = {
    overview: jest.fn().mockResolvedValue({}),
    sales: jest.fn().mockResolvedValue({}),
    proposals: jest.fn().mockResolvedValue({}),
    tasks: jest.fn().mockResolvedValue({}),
    team: jest.fn().mockResolvedValue({}),
    communications: jest.fn().mockResolvedValue({}),
    trends: jest.fn().mockResolvedValue({}),
    insights: jest.fn().mockResolvedValue({}),
  };
  const controller = new AnalyticsController(service as never);
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherTenant = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const req = { user: { userId: 'user-1', tenantId, email: 'a@example.com', name: 'A', role: 'owner' } } as never;

  beforeEach(() => jest.clearAllMocks());

  it('requires JWT on every analytics route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalyticsController) ?? []).toContain(JwtAuthGuard);
  });

  it('uses the authenticated tenant for overview, sales, proposals, tasks, team, communications, trends, and insights', async () => {
    const query = { range: '30d' as const, tenantId: otherTenant };
    await controller.overview(req, query as never);
    await controller.sales(req, query as never);
    await controller.proposals(req, query as never);
    await controller.tasks(req, query as never);
    await controller.team(req, query as never);
    await controller.communications(req, query as never);
    await controller.trends(req, query as never);
    await controller.insights(req, query as never);

    for (const method of Object.values(service)) {
      expect(method).toHaveBeenCalledWith(tenantId, query);
      expect(method.mock.calls[0][0]).not.toBe(otherTenant);
    }
  });

  it('rejects an unauthenticated request', () => {
    expect(() => controller.overview({ user: undefined } as never, {})).toThrow(UnauthorizedException);
    expect(service.overview).not.toHaveBeenCalled();
  });
});
