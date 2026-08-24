import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../../../modules/auth/auth.module.js';
import { GmailModule } from '../communication/gmail/gmail.module.js';
import { ProposalController } from './proposal.controller.js';
import { ProposalService } from './proposal.service.js';
import { ProposalAgent } from './proposal-agent.js';
import { ProposalDeliveryService } from './proposal-delivery.service.js';
import { ProposalRepository } from './proposal.repository.js';
import { CreateProposalTool } from './tools/create-proposal.tool.js';
import { UpdateProposalTool } from './tools/update-proposal.tool.js';
import { GetProposalTool } from './tools/get-proposal.tool.js';
import { ListProposalsTool } from './tools/list-proposals.tool.js';
import { GenerateProposalTool } from './tools/generate-proposal.tool.js';
import { ChangeProposalStatusTool } from './tools/change-proposal-status.tool.js';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    GmailModule,
  ],
  controllers: [ProposalController],
  providers: [
    ProposalService,
    ProposalAgent,
    ProposalDeliveryService,
    ProposalRepository,
    CreateProposalTool,
    UpdateProposalTool,
    GetProposalTool,
    ListProposalsTool,
    GenerateProposalTool,
    ChangeProposalStatusTool,
  ],
  exports: [ProposalService, ProposalRepository, ProposalAgent],
})
export class ProposalModule {}
