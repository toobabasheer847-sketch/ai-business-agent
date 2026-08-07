import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class CreateProposalTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'create_proposal',
      description:
        'Create a tenant-scoped business proposal linked to a prospect. Always require prospectId and title.',
      parameters: z.object({
        tenantId: z.string(),
        createdBy: z.string(),
        prospectId: z.string(),
        title: z.string().min(3),
        description: z.string().optional(),
        requirements: z.string().optional(),
        price: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().optional(),
      }),
      execute: async (input: any) => this.proposalRepository.createProposal(input),
    });
  }
}
