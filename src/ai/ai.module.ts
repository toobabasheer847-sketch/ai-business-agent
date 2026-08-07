import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MasterAgentModule } from './agents/master/master.module';
import { CommunicationAgentModule } from './agents/communication/communication.module';
import { RagModule } from './agents/rag/rag.module';

@Module({
  imports: [ConfigModule, MasterAgentModule, CommunicationAgentModule, RagModule],
  exports: [MasterAgentModule, CommunicationAgentModule, RagModule],
})
export class AiModule {}
