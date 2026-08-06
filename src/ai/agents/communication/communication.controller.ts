import { Controller, Get } from '@nestjs/common';

import { CommunicationAgentService } from './communication.service';

@Controller('ai/communication')
export class CommunicationAgentController {
  constructor(
    private readonly communicationAgentService: CommunicationAgentService,
  ) {}

  @Get('status')
  getStatus() {
    const agent = this.communicationAgentService.getAgent();

    return {
      status: 'success',
      agent: agent.name,
    };
  }
}