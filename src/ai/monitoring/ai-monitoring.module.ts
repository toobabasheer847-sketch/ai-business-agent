import { Global, Module } from '@nestjs/common';

import { AgentRunController } from './agent-run.controller';
import { AgentRunQueryService } from './agent-run.query';
import { DrizzleAgentRunStore } from './agent-run.store';
import { AgentRunTracker } from './agent-run.tracker';

@Global()
@Module({
  controllers: [AgentRunController],
  providers: [DrizzleAgentRunStore, AgentRunTracker, AgentRunQueryService],
  exports: [AgentRunTracker],
})
export class AiMonitoringModule {}
