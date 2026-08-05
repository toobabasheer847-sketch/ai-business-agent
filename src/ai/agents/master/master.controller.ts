import { Controller, Get } from '@nestjs/common';

import { MasterAgentService } from './master.service';

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