import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { BusinessIntelligenceService } from './business-intelligence.service';

@UseGuards(JwtAuthGuard)
@Controller('business-intelligence')
export class BusinessIntelligenceController {
  constructor(private readonly intelligence: BusinessIntelligenceService) {}

  @Get('overview')
  overview(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.overview(request.user.tenantId, query);
  }

  @Get('sales-forecast')
  salesForecast(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.salesForecast(request.user.tenantId, query);
  }

  @Get('lead-insights')
  leadInsights(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.leadInsights(request.user.tenantId, query);
  }

  @Get('revenue-pipeline')
  revenuePipeline(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.revenuePipeline(request.user.tenantId, query);
  }

  @Get('workload-forecast')
  workloadForecast(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.workloadForecast(request.user.tenantId, query);
  }

  @Get('risks')
  risks(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.risks(request.user.tenantId, query);
  }

  @Get('insights')
  insights(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.insights(request.user.tenantId, query);
  }

  @Post('refresh')
  refresh(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.intelligence.refresh(request.user.tenantId, query);
  }

  @Get('forecasts/:id')
  forecast(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.intelligence.forecast(request.user.tenantId, id);
  }
}
