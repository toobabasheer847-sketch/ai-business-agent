import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { ProposalDeliveryService } from '../proposal-delivery.service.js';
import { ProposalRepository } from '../proposal.repository.js';
import { ProposalStatus } from '../types/proposal.types.js';

const STATUSES = ['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const;

@Injectable()
export class ChangeProposalStatusTool extends FunctionTool<any> {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly proposalDelivery: ProposalDeliveryService,
  ) {
    super({
      name: 'change_proposal_status',
      description:
        'Transition a proposal to a new status. When status is sent, emails the proposal to the prospect via the authenticated tenant Gmail account.',
      parameters: z.object({
        proposalId: z.string(),
        status: z.enum(STATUSES),
        fromEmail: z.string().email().optional(),
      }),
      execute: async (input: any) => {
        const { tenantId } = getTrustedAiContext();
        const existing = await this.proposalRepository.getProposal(
          input.proposalId,
          tenantId,
        );
        if (!existing) {
          return null;
        }

        const status: ProposalStatus = input.status;
        if (status === 'sent' && existing.status !== 'sent') {
          await this.proposalDelivery.sendProposalEmail({
            proposal: existing,
            tenantId,
            fromEmail: input.fromEmail,
          });
        }

        const update: any = { status };
        const now = new Date().toISOString();
        if (status === 'sent') update.sentAt = now;
        if (status === 'viewed') update.viewedAt = now;
        if (status === 'accepted') update.acceptedAt = now;
        if (status === 'rejected') update.rejectedAt = now;
        return this.proposalRepository.updateProposal(input.proposalId, tenantId, update);
      },
    });
  }
}
