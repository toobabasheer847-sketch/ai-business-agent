import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/types/auth.types.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRangeQueryDto } from './dto/dashboard-range-query.dto.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  overview(@Req() req: AuthenticatedRequest, @Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.overview(this.tenantId(req), query);
  }

  @Get('sales-pipeline')
  salesPipeline(@Req() req: AuthenticatedRequest, @Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.salesPipeline(this.tenantId(req), query);
  }

  @Get('tasks-summary')
  tasksSummary(@Req() req: AuthenticatedRequest, @Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.tasksSummary(this.tenantId(req), query);
  }

  @Get('recent-activity')
  recentActivity(@Req() req: AuthenticatedRequest, @Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.recentActivity(this.tenantId(req), query);
  }

  @Get('communications-summary')
  communicationsSummary(@Req() req: AuthenticatedRequest, @Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.communicationsSummary(this.tenantId(req), query);
  }

  private tenantId(req: AuthenticatedRequest): string {
    const tenantId = req.user?.tenantId?.trim();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return tenantId;
  }
}
