import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class GetProposalTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'get_proposal',
      description: 'Fetch a single tenant-scoped proposal by id.',
      parameters: z.object({
        proposalId: z.string(),
      }),
      execute: async (input: any) => {
        const { tenantId } = getTrustedAiContext();
        return this.proposalRepository.getProposal(input.proposalId, tenantId);
      },
    });
  }
}
