import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { ProposalController } from './proposal.controller.js';
import { ProposalService } from './proposal.service.js';
import { ProposalAgent } from './proposal-agent.js';
import { ProposalRepository } from './proposal.repository.js';
import { CreateProposalTool } from './tools/create-proposal.tool.js';
import { UpdateProposalTool } from './tools/update-proposal.tool.js';
import { GetProposalTool } from './tools/get-proposal.tool.js';
import { ListProposalsTool } from './tools/list-proposals.tool.js';
import { GenerateProposalTool } from './tools/generate-proposal.tool.js';
import { ChangeProposalStatusTool } from './tools/change-proposal-status.tool.js';
import { AuthGuard } from '../../../common/guards/auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'development-secret'),
        signOptions: {
          expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN', '86400')),
        },
      }),
    }),
  ],
  controllers: [ProposalController],
  providers: [
    ProposalService,
    ProposalAgent,
    ProposalRepository,
    CreateProposalTool,
    UpdateProposalTool,
    GetProposalTool,
    ListProposalsTool,
    GenerateProposalTool,
    ChangeProposalStatusTool,
    AuthGuard,
  ],
  exports: [ProposalService, ProposalRepository, ProposalAgent],
})
export class ProposalModule {}
