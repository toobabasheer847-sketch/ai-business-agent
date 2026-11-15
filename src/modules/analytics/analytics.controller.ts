import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/types/auth.types.js';
import { hasPermission, Permission } from '../authorization/permissions';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsQueryDto } from './dto/analytics-query.dto.js';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.overview(this.tenantId(req), query);
  }

  @Get('sales')
  sales(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.sales(this.tenantId(req), query);
  }

  @Get('proposals')
  proposals(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.proposals(this.tenantId(req), query);
  }

  @Get('tasks')
  tasks(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    const scope = this.ownScope(req);
    const tenantId = this.tenantId(req);
    return scope
      ? this.analyticsService.tasks(tenantId, query, scope)
      : this.analyticsService.tasks(tenantId, query);
  }

  @Get('team')
  team(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.team(this.tenantId(req), query);
  }

  @Get('communications')
  communications(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.communications(this.tenantId(req), query);
  }

  @Get('trends')
  trends(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    const scope = this.ownScope(req);
    const tenantId = this.tenantId(req);
    return scope
      ? this.analyticsService.trends(tenantId, query, scope)
      : this.analyticsService.trends(tenantId, query);
  }

  @Get('insights')
  insights(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.insights(this.tenantId(req), query);
  }

  private ownScope(req: AuthenticatedRequest): string | undefined {
    return hasPermission(req.user?.role, Permission.AnalyticsView) ? undefined : req.user.userId;
  }

  private tenantId(req: AuthenticatedRequest): string {
    const tenantId = req.user?.tenantId?.trim();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return tenantId;
  }
}
