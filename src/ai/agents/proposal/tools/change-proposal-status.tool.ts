import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { ProposalRepository } from '../proposal.repository.js';
import { ProposalStatus } from '../types/proposal.types.js';

const STATUSES = ['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const;

@Injectable()
export class ChangeProposalStatusTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'change_proposal_status',
      description:
        'Transition a proposal to a new status. Automatically sets sentAt/viewedAt/acceptedAt/rejectedAt timestamps when relevant.',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
        status: z.enum(STATUSES),
      }),
      execute: async (input: any) => {
        const status: ProposalStatus = input.status;
        const update: any = { status };
        const now = new Date().toISOString();
        if (status === 'sent') update.sentAt = now;
        if (status === 'viewed') update.viewedAt = now;
        if (status === 'accepted') update.acceptedAt = now;
        if (status === 'rejected') update.rejectedAt = now;
        return this.proposalRepository.updateProposal(input.proposalId, input.tenantId, update);
      },
    });
  }
}
