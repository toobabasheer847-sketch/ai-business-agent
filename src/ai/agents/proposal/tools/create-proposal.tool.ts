import { BadRequestException, Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class CreateProposalTool extends FunctionTool<any> {
  constructor(private readonly proposalRepository: ProposalRepository) {
    super({
      name: 'create_proposal',
      description:
        'Create a tenant-scoped business proposal linked to a prospect. Always require prospectId and title.',
      parameters: z.object({
        prospectId: z.string(),
        title: z.string().min(3),
        description: z.string().optional(),
        requirements: z.string().optional(),
        price: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().optional(),
      }),
      execute: async (input: any) => {
        const context = getTrustedAiContext();
        const prospect = await this.proposalRepository.getProspect(
          input.prospectId,
          context.tenantId,
        );
        if (!prospect) {
          throw new BadRequestException('Prospect not found for this tenant');
        }
        return this.proposalRepository.createProposal({
          tenantId: context.tenantId,
          createdBy: context.userId,
          prospectId: input.prospectId,
          title: input.title,
          description: input.description,
          requirements: input.requirements,
          price: input.price,
          currency: input.currency,
          validUntil: input.validUntil,
        });
      },
    });
  }
}
