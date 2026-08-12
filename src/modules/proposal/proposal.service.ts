import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ProposalRepository } from './proposal.repository';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ProposalQueryDto } from './dto/proposal-query.dto';

/** Statuses that are considered terminal — only allow metadata/content edits, not status regression */
const TERMINAL_STATUSES = new Set(['accepted', 'rejected']);

@Injectable()
export class ProposalService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
  ) {}

  private normalizeOptional(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  async create(tenantId: string, userId: string, dto: CreateProposalDto) {
    // Verify the prospect belongs to the same tenant
    const prospect = await this.proposalRepository.findProspectByIdAndTenant(
      dto.prospectId,
      tenantId,
    );

    if (!prospect) {
      throw new BadRequestException(
        'Prospect not found or does not belong to your tenant.',
      );
    }

    return this.proposalRepository.create({
      tenantId,
      prospectId: dto.prospectId,
      createdBy: userId,
      title: dto.title.trim(),
      description: dto.description?.trim(),
      content: dto.content?.trim(),
      status: dto.status,
    });
  }

  async findAll(tenantId: string, query: ProposalQueryDto) {
    return this.proposalRepository.findAllByTenant(tenantId, {
      status: query.status,
      prospectId: query.prospectId,
      createdBy: query.createdBy,
      search: query.search,
    });
  }

  async findOne(tenantId: string, id: string) {
    const proposal = await this.proposalRepository.findByIdAndTenant(id, tenantId);

    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }

    return proposal;
  }

  async update(tenantId: string, id: string, dto: UpdateProposalDto) {
    const existing = await this.proposalRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Proposal not found.');
    }

    // Prevent status regression for terminal proposals
    if (TERMINAL_STATUSES.has(existing.status)) {
      // Only allow content/description edits on terminal proposals, not status changes
      if (dto.status !== undefined && dto.status !== existing.status) {
        throw new BadRequestException(
          `A proposal with status '${existing.status}' cannot have its status changed.`,
        );
      }
    }

    return this.proposalRepository.update(id, tenantId, {
      title: dto.title !== undefined ? dto.title.trim() : undefined,
      description: this.normalizeOptional(dto.description),
      content: this.normalizeOptional(dto.content),
      status: dto.status,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.proposalRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Proposal not found.');
    }

    await this.proposalRepository.delete(id, tenantId);

    return {
      message: 'Proposal deleted successfully.',
      id,
    };
  }
}
