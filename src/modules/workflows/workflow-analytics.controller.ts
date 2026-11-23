import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { WorkflowAnalyticsService } from './workflow-analytics.service';

class UpdateRecommendationDto {
  @IsString()
  @IsIn([
    'open',
    'reviewed',
    'dismissed',
    'applied',
    'OPEN',
    'REVIEWED',
    'DISMISSED',
    'APPLIED',
  ])
  status!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('workflow-analytics')
export class WorkflowAnalyticsController {
  constructor(private readonly analytics: WorkflowAnalyticsService) {}

  @Get('overview')
  overview(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.overview(request.user.tenantId, query);
  }

  @Get('trends')
  trends(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.trends(request.user.tenantId, query);
  }

  @Get('failures')
  failures(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.failures(request.user.tenantId, query);
  }

  @Get('optimizations')
  optimizations(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.optimizations(request.user.tenantId, query);
  }

  @Patch('optimizations/:id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecommendationDto,
  ) {
    return this.analytics.updateStatus(request.user.tenantId, id, dto.status);
  }

  @Get('workflows/:id')
  workflow(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.workflow(request.user.tenantId, id, query);
  }

  @Get('workflows')
  workflows(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.analytics.workflows(request.user.tenantId, query);
  }
}
