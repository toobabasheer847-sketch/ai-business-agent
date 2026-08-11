import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MasterAgentModule } from './agents/master/master.module';
import { CommunicationAgentModule } from './agents/communication/communication.module';
import { RagModule } from './agents/rag/rag.module';
import { TaskModule } from './agents/task/task.module';
import { ProposalModule } from './agents/proposal/proposal.module';

@Module({
  imports: [ConfigModule, MasterAgentModule, CommunicationAgentModule, RagModule, TaskModule, ProposalModule],
  exports: [MasterAgentModule, CommunicationAgentModule, RagModule, TaskModule, ProposalModule],
})
export class AiModule {}
