import { Module } from '@nestjs/common';

import { ConversationModule } from '../../../modules/conversation/conversation.module';
import { MasterSettingsModule } from '../../../modules/master-settings/master-settings.module';
import { AdkAgentFactoryService } from '../../adk/adk-agent.factory.js';
import { CommunicationAgentModule } from '../communication/communication.module.js';
import { ProposalModule } from '../proposal/proposal.module.js';
import { RagModule } from '../rag/rag.module.js';
import { TaskModule } from '../task/task.module.js';
import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';

@Module({
  imports: [
    CommunicationAgentModule,
    ConversationModule,
    MasterSettingsModule,
    ProposalModule,
    RagModule,
    TaskModule,
  ],
  controllers: [MasterAgentController],
  providers: [MasterAgentService, AdkAgentFactoryService],
  exports: [MasterAgentService],
})
export class MasterAgentModule {}
