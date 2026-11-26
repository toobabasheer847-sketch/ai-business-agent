import { Module } from '@nestjs/common';

import { OmnichannelModule } from '../../modules/omnichannel/omnichannel.module';
import { CompanyModule } from '../../modules/company/company.module';
import { CommunicationAgentModule } from '../agents/communication/communication.module';
import { ProposalModule } from '../agents/proposal/proposal.module';
import { TaskModule } from '../agents/task/task.module';
import { ApprovalExecutionRegistrar } from './approval-execution.registrar';
import { ApprovalModule } from './approval.module';

@Module({
  imports: [ApprovalModule, CompanyModule, ProposalModule, CommunicationAgentModule, TaskModule, OmnichannelModule],
  providers: [ApprovalExecutionRegistrar],
})
export class ApprovalExecutionModule {}
