import { Module } from '@nestjs/common';

import { CommunicationAgentModule } from '../communication/communication.module.js';
import { ProposalModule } from '../proposal/proposal.module.js';
import { RagModule } from '../rag/rag.module.js';
import { TaskModule } from '../task/task.module.js';
import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';

@Module({
  imports: [
    CommunicationAgentModule,
    ProposalModule,
    RagModule,
    TaskModule,
  ],
  controllers: [MasterAgentController],
  providers: [MasterAgentService],
  exports: [MasterAgentService],
})
export class MasterAgentModule {}