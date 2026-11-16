import { Injectable, Optional } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { assertRolePermission } from '../../../context/assert-ai-permission.js';
import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { Permission } from '../../../../modules/authorization/permissions';
import { ProposalDeliveryService } from '../proposal-delivery.service.js';
import { ProposalRepository } from '../proposal.repository.js';
import { ApprovalService } from '../../../approvals/approval.service';
import { ProposalStatus } from '../types/proposal.types.js';

const STATUSES = ['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const;

@Injectable()
export class ChangeProposalStatusTool extends FunctionTool<any> {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly proposalDelivery: ProposalDeliveryService,
    @Optional() private readonly approvals?: ApprovalService,
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
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.ProposalManage]);
        if (input.status === 'sent') {
          assertRolePermission(trusted.role, [Permission.ProposalSend]);
        }
        const tenantId = trusted.tenantId;
        const existing = await this.proposalRepository.getProposal(
          input.proposalId,
          tenantId,
        );
        if (!existing) {
          return null;
        }

        const status: ProposalStatus = input.status;
        if (status === 'sent' && existing.status !== 'sent') {
          if (this.approvals) {
            await this.approvals.propose({
              tenantId,
              userId: trusted.userId,
              role: trusted.role ?? undefined,
              actionType: 'proposal.send',
              title: `Send ${existing.title ?? 'proposal'}`.slice(0, 200),
              description: 'The proposal email waits in the Approval Center and has not been sent.',
              targetEntityType: 'proposal',
              targetEntityId: existing.id,
              payload: { proposalId: existing.id },
              agentName: 'proposal-tool',
            });
          }
          return {
            proposalId: existing.id,
            status: 'pending_approval',
            message: 'Sending this proposal requires approval and was not emailed.',
          };
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
