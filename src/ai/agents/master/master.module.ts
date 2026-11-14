import { Module } from '@nestjs/common';

import { CommunicationHubModule } from '../../../modules/communication-hub/communication-hub.module.js';
import { CompanyModule } from '../../../modules/company/company.module.js';
import { ConversationModule } from '../../../modules/conversation/conversation.module';
import { DashboardModule } from '../../../modules/dashboard/dashboard.module.js';
import { LeadModule } from '../../../modules/lead/lead.module.js';
import { MasterSettingsModule } from '../../../modules/master-settings/master-settings.module';
import { ProspectModule } from '../../../modules/prospect/prospect.module.js';
import { AdkAgentFactoryService } from '../../adk/adk-agent.factory.js';
import { CommunicationAgentModule } from '../communication/communication.module.js';
import { ProposalModule } from '../proposal/proposal.module.js';
import { RagModule } from '../rag/rag.module.js';
import { TaskModule } from '../task/task.module.js';
import { TeamAgentModule } from '../team/team-agent.module.js';
import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';
import { MasterOrchestratorService } from './orchestrator/orchestrator.service.js';

@Module({
  imports: [
    CommunicationAgentModule,
    CommunicationHubModule,
    CompanyModule,
    ConversationModule,
    DashboardModule,
    LeadModule,
    MasterSettingsModule,
    ProposalModule,
    ProspectModule,
    RagModule,
    TaskModule,
    TeamAgentModule,
  ],
  controllers: [MasterAgentController],
  providers: [MasterAgentService, AdkAgentFactoryService, MasterOrchestratorService],
  exports: [MasterAgentService],
})
export class MasterAgentModule {}
