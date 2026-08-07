import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class GetProposalTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'get_proposal',
      description: 'Fetch a single tenant-scoped proposal by id.',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) =>
        this.proposalRepository.getProposal(input.proposalId, input.tenantId),
    });
  }
}
