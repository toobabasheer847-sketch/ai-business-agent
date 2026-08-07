import { Injectable } from '@nestjs/common';

import { masterAgent } from './master.agent.js';

@Injectable()
export class MasterAgentService {
  getAgent() {
    return masterAgent;
  }
}