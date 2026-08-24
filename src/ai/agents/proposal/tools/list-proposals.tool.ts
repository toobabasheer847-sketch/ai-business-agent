import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class ListProposalsTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'list_proposals',
      description:
        'List tenant-scoped proposals. Optionally filter by status, prospectId, or search by title/description.',
      parameters: z.object({
        status: z
          .enum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'])
          .optional(),
        prospectId: z.string().optional(),
        search: z.string().optional(),
      }),
      execute: async (input: any) => {
        const { tenantId } = getTrustedAiContext();
        return this.proposalRepository.listProposals(tenantId, {
          status: input.status,
          prospectId: input.prospectId,
          search: input.search,
        });
      },
    });
  }
}
