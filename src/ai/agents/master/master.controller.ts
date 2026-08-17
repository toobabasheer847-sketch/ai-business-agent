import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { MasterAgentService } from './master.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/master')
export class MasterAgentController {
  constructor(
    private readonly masterAgentService: MasterAgentService,
  ) {}

  @Get('status')
  getStatus() {
    const agent = this.masterAgentService.getAgent();

    return {
      status: 'success',
      agent: agent.name,
    };
  }
}