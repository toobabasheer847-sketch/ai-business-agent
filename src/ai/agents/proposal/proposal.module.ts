import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../../../modules/auth/auth.module.js';
import { GmailModule } from '../communication/gmail/gmail.module.js';
import { ProposalController } from './proposal.controller.js';
import { ProposalService } from './proposal.service.js';
import { ProposalAgent } from './proposal-agent.js';
import { ProposalPdfService } from './proposal-pdf.service.js';
import { ProposalDeliveryService } from './proposal-delivery.service.js';
import { ProposalRepository } from './proposal.repository.js';
import { PublicProposalController } from './public-proposal.controller.js';
import { PublicProposalAccessService } from './public-proposal-access.service.js';
import {
  PublicProposalRateLimitGuard,
  PublicProposalRateLimiter,
} from './public-proposal-rate-limit.js';
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
  controllers: [ProposalController, PublicProposalController],
  providers: [
    ProposalService,
    ProposalAgent,
    ProposalPdfService,
    ProposalDeliveryService,
    ProposalRepository,
    PublicProposalAccessService,
    PublicProposalRateLimiter,
    PublicProposalRateLimitGuard,
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
