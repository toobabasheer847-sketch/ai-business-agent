import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { CommunicationAgentService } from './communication.service';

@UseGuards(JwtAuthGuard)
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
