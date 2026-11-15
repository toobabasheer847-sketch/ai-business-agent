import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../modules/auth/types/auth.types';
import { AgentRunQueryService } from './agent-run.query';
import { canReadMonitoring } from './monitoring-query';

@UseGuards(JwtAuthGuard)
@Controller('ai-monitoring')
export class AgentRunController {
  constructor(private readonly runs: AgentRunQueryService) {}

  @Get('summary')
  summary(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agent') agent?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('status') status?: string,
  ) {
    this.assertReader(req);
    return this.runs.summary(req.user, { from, to, agent, provider, model, status });
  }

  @Get('runs/:id')
  find(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.assertReader(req);
    return this.runs.find(req.user, id);
  }

  @Get('runs')
  list(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agent') agent?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('direction') direction?: string,
  ) {
    this.assertReader(req);
    return this.runs.list(req.user, { page, limit, from, to, agent, provider, model, status, sort, direction });
  }

  private assertReader(req: AuthenticatedRequest) {
    if (!canReadMonitoring(req.user.role)) {
      throw new ForbiddenException('You do not have access to AI monitoring.');
    }
  }
}
