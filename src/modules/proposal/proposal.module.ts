import { Module } from '@nestjs/common';

import { ProposalController } from './proposal.controller';
import { ProposalRepository } from './proposal.repository';
import { ProposalService } from './proposal.service';

@Module({
  controllers: [ProposalController],
  providers: [ProposalService, ProposalRepository],
  exports: [ProposalService, ProposalRepository],
})
export class ProposalModule {}
