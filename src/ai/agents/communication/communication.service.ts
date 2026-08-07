import { Injectable } from '@nestjs/common';

import { communicationAgent } from './communication-agent';

@Injectable()
export class CommunicationAgentService {
  getAgent() {
    return communicationAgent;
  }
}