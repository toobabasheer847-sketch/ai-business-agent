import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class UpdateProposalTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'update_proposal',
      description:
        'Update a tenant-scoped proposal (title, description, requirements, price, currency, validUntil, content, status).',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
        prospectId: z.string().optional(),
        title: z.string().min(3).optional(),
        description: z.string().optional(),
        requirements: z.string().optional(),
        status: z
          .enum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'])
          .optional(),
        price: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (input: any) =>
        this.proposalRepository.updateProposal(input.proposalId, input.tenantId, input),
    });
  }
}
