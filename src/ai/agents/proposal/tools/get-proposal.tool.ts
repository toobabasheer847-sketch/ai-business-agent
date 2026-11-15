import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { assertRolePermission } from '../../../context/assert-ai-permission.js';
import { getTrustedAiContext } from '../../../context/ai-request-context.js';
import { Permission } from '../../../../modules/authorization/permissions';
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
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.ProposalView]);
        return this.proposalRepository.getProposal(input.proposalId, trusted.tenantId);
      },
    });
  }
}
