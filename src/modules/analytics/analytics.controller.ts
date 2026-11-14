import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/types/auth.types.js';
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
    return this.analyticsService.tasks(this.tenantId(req), query);
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
    return this.analyticsService.trends(this.tenantId(req), query);
  }

  @Get('insights')
  insights(@Req() req: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.insights(this.tenantId(req), query);
  }

  private tenantId(req: AuthenticatedRequest): string {
    const tenantId = req.user?.tenantId?.trim();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return tenantId;
  }
}
