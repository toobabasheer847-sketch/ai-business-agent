import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { UpdateProposalDto } from './dto/update-proposal.dto.js';
import { ProposalQueryDto } from './dto/proposal-query.dto.js';
import { GenerateProposalDto } from './dto/generate-proposal.dto.js';
import { ChangeProposalStatusDto } from './dto/change-proposal-status.dto.js';
import { ProposalAgent } from './proposal-agent.js';
import { ProposalRepository } from './proposal.repository.js';
import {
  ProposalContext,
  ProposalLength,
  ProposalRecord,
  ProposalStatus,
  ProposalTone,
} from './types/proposal.types.js';

@Injectable()
export class ProposalService {
  constructor(
    private readonly proposalAgent: ProposalAgent,
    private readonly proposalRepository: ProposalRepository,
    private readonly configService: ConfigService,
  ) {}

  async createProposal(dto: CreateProposalDto, context: ProposalContext): Promise<ProposalRecord> {
    this.requireContext(context);

    const prospect = await this.proposalRepository.getProspect(dto.prospectId, context.tenantId);
    if (!prospect) {
      throw new NotFoundException('Prospect not found in this tenant');
    }

    try {
      const created = await this.proposalRepository.createProposal({
        tenantId: context.tenantId,
        createdBy: context.userId,
        prospectId: dto.prospectId,
        title: dto.title,
        description: dto.description ?? null,
        requirements: dto.requirements ?? null,
        status: (dto.status as ProposalStatus) ?? 'draft',
        price: dto.price ?? null,
        currency: dto.currency ?? 'USD',
        validUntil: dto.validUntil ?? null,
        content: dto.content ?? null,
      });

      await this.audit(context, 'proposal.created', created.id, 'Created proposal', {
        prospectId: dto.prospectId,
        title: dto.title,
      });

      return created;
    } catch (error) {
      this.handleError(error, 'create proposal');
    }
  }

  async getProposal(proposalId: string, context: ProposalContext): Promise<ProposalRecord> {
    this.requireContext(context);

    const proposal = await this.proposalRepository.getProposal(proposalId, context.tenantId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access proposals for another tenant');
    }

    return proposal;
  }

  async listProposals(dto: ProposalQueryDto, context: ProposalContext): Promise<ProposalRecord[]> {
    this.requireContext(context);

    return this.proposalRepository.listProposals(context.tenantId, {
      status: dto.status as ProposalStatus,
      prospectId: dto.prospectId,
      search: dto.search,
    });
  }

  async updateProposal(
    proposalId: string,
    dto: UpdateProposalDto,
    context: ProposalContext,
  ): Promise<ProposalRecord> {
    this.requireContext(context);

    const existing = await this.proposalRepository.getProposal(proposalId, context.tenantId);
    if (!existing) {
      throw new NotFoundException('Proposal not found');
    }

    if (existing.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access proposals for another tenant');
    }

    if (dto.prospectId && dto.prospectId !== existing.prospectId) {
      const prospect = await this.proposalRepository.getProspect(dto.prospectId, context.tenantId);
      if (!prospect) {
        throw new NotFoundException('New prospect not found in this tenant');
      }
    }

    const changes = this.diffChanges(existing, dto);

    const updated = await this.proposalRepository.updateProposal(proposalId, context.tenantId, {
      prospectId: dto.prospectId,
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      status: dto.status as ProposalStatus,
      price: dto.price,
      currency: dto.currency,
      validUntil: dto.validUntil,
      content: dto.content,
    });

    if (!updated) {
      throw new NotFoundException('Proposal not found');
    }

    await this.audit(context, 'proposal.updated', proposalId, 'Updated proposal', changes);

    return updated;
  }

  async generateProposal(
    proposalId: string,
    dto: GenerateProposalDto,
    context: ProposalContext,
  ): Promise<ProposalRecord> {
    this.requireContext(context);

    const existing = await this.proposalRepository.getProposal(proposalId, context.tenantId);
    if (!existing) {
      throw new NotFoundException('Proposal not found');
    }

    if (existing.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access proposals for another tenant');
    }

    const prospectId = dto.prospectId ?? existing.prospectId;

    const prospect = await this.proposalRepository.getProspect(prospectId, context.tenantId);
    if (!prospect) {
      throw new BadRequestException('Prospect not found in this tenant; cannot gather context for generation');
    }

    const genCtx = await this.proposalRepository.gatherGenerationContext(prospectId, context.tenantId);
    if (!genCtx) {
      throw new InternalServerErrorException(
        'Failed to gather generation context (company lookup for prospect failed)',
      );
    }

    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    const tone = (dto.tone as ProposalTone) ?? 'professional';
    const length = (dto.length as ProposalLength) ?? 'medium';

    let generatedContent: string;
    if (!apiKey) {
      generatedContent = this.buildFallbackContent(existing, genCtx, dto.instructions, tone, length);
    } else {
      const { Gemini } = require('@google/adk');
      const model = new Gemini({ model: modelName, apiKey });
      const prompt = this.buildPrompt(existing, genCtx, dto.instructions, tone, length);
      const response = await model.generateContent(prompt);
      generatedContent =
        response?.text?.() ?? this.buildFallbackContent(existing, genCtx, dto.instructions, tone, length);
    }

    const update: any = {
      content: generatedContent,
      status: 'generated' as ProposalStatus,
    };

    if (dto.instructions && !existing.requirements) {
      update.requirements = dto.instructions;
    }

    const updated = await this.proposalRepository.updateProposal(proposalId, context.tenantId, update);
    if (!updated) {
      throw new NotFoundException('Proposal not found during update-after-generate');
    }

    await this.audit(context, 'proposal.generated', proposalId, 'AI-generated proposal content', {
      tone,
      length,
      hasCustomInstructions: !!dto.instructions,
    });

    return updated;
  }

  async changeProposalStatus(
    proposalId: string,
    dto: ChangeProposalStatusDto,
    context: ProposalContext,
  ): Promise<ProposalRecord> {
    this.requireContext(context);

    const existing = await this.proposalRepository.getProposal(proposalId, context.tenantId);
    if (!existing) {
      throw new NotFoundException('Proposal not found');
    }

    if (existing.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access proposals for another tenant');
    }

    const newStatus = dto.status as ProposalStatus;
    const oldStatus = existing.status;

    const update: any = { status: newStatus };
    const now = new Date().toISOString();
    if (newStatus === 'sent') update.sentAt = now;
    if (newStatus === 'viewed') update.viewedAt = now;
    if (newStatus === 'accepted') update.acceptedAt = now;
    if (newStatus === 'rejected') update.rejectedAt = now;

    const updated = await this.proposalRepository.updateProposal(proposalId, context.tenantId, update);
    if (!updated) {
      throw new NotFoundException('Proposal not found');
    }

    await this.audit(context, 'proposal.status_changed', proposalId, `Changed proposal status`, {
      from: oldStatus,
      to: newStatus,
    });

    return updated;
  }

  async processNaturalLanguage(request: string, context: ProposalContext): Promise<any> {
    this.requireContext(context);
    if (!request || typeof request !== 'string' || request.trim().length === 0) {
      throw new BadRequestException('Message must be a non-empty string');
    }
    return this.proposalAgent.processRequest(context, request.trim());
  }

  private requireContext(context: ProposalContext): void {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    if (!context?.userId) {
      throw new UnauthorizedException('Authenticated user is required');
    }
  }

  private async audit(
    context: ProposalContext,
    action: string,
    entityId: string,
    description: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      await this.proposalRepository.writeAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        entityType: 'proposal',
        entityId,
        description,
        metadata,
      });
    } catch (err) {
      console.error('ProposalService audit log write failed (non-fatal)', err);
    }
  }

  private diffChanges(prev: ProposalRecord, dto: UpdateProposalDto): Record<string, any> {
    const changes: Record<string, any> = {};
    if (dto.title !== undefined && dto.title !== prev.title) changes.title = dto.title;
    if (dto.description !== undefined && dto.description !== prev.description)
      changes.description = true;
    if (dto.requirements !== undefined && dto.requirements !== prev.requirements)
      changes.requirements = true;
    if (dto.status !== undefined && dto.status !== prev.status) {
      changes.status = { from: prev.status, to: dto.status };
    }
    if (dto.price !== undefined && String(dto.price) !== String(prev.price ?? ''))
      changes.price = { from: prev.price, to: dto.price };
    if (dto.currency !== undefined && dto.currency !== prev.currency) changes.currency = dto.currency;
    if (dto.prospectId !== undefined && dto.prospectId !== prev.prospectId)
      changes.prospectId = dto.prospectId;
    if (dto.validUntil !== undefined) changes.validUntil = true;
    if (dto.content !== undefined) changes.content = true;
    return changes;
  }

  private handleError(error: unknown, operation: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }
    console.error(`ProposalService.${operation} failed`, error);
    throw new InternalServerErrorException(`Failed to ${operation}`);
  }

  private buildPrompt(
    proposal: ProposalRecord,
    ctx: any,
    instructions: string | undefined,
    tone: string,
    length: string,
  ): string {
    const kbLines = ctx.knowledgeBases
      .map((kb: any) => `- ${kb.name}${kb.description ? `: ${kb.description}` : ''}`)
      .join('\n');

    return `You are a professional business proposal writer for ${ctx.brand?.name ?? 'our company'}.

WRITING STYLE REQUIREMENTS:
- Tone: ${tone}
- Length: ${length}
- Output format: Markdown

NON-HALLUCINATION RULES (CRITICAL):
- Only use factual data provided below. Do NOT invent company taglines, case studies, pricing, addresses, team names, or service lists that are not present in the provided context.
- If service/offering details are missing from knowledge bases, clearly mark the section "To be filled with our service details" rather than inventing content.
- For pricing, use ${proposal.price ? proposal.price + ' ' + (proposal.currency ?? 'USD') : 'NOT SPECIFIED — show a clearly marked placeholder.'}.
- For validity/expiry, use ${proposal.validUntil ? new Date(proposal.validUntil as any).toISOString() : 'NOT SPECIFIED.'}.

GENERATED SECTIONS (all as Markdown):
1. Proposal Title (Header 1, include prospect company name)
2. Introduction
3. Understanding of Client Requirements
4. Proposed Solution / Services
5. Scope of Work / Deliverables
6. Timeline (phases in weeks/months; if unknown use illustrative "TBD per discussion" placeholders)
7. Pricing (breakdown if possible; otherwise a total; NEVER invent line items that are not in context)
8. Terms & Conditions (use standard, conservative language)
9. Next Steps
10. Closing

=== PROVIDED CONTEXT ===

PROSPECT:
- Name: ${ctx.prospect.firstName} ${ctx.prospect.lastName ?? ''}
- Title: ${ctx.prospect.jobTitle ?? 'N/A'}
- Email: ${ctx.prospect.email ?? 'N/A'}
- Phone: ${ctx.prospect.phone ?? 'N/A'}
- Status: ${ctx.prospect.status ?? 'N/A'}
- Notes: ${ctx.prospect.notes ?? 'None'}

PROSPECT'S COMPANY:
- Name: ${ctx.company.name}
- Domain: ${ctx.company.domain ?? 'N/A'}
- Website: ${ctx.company.website ?? 'N/A'}
- Industry: ${ctx.company.industry ?? 'N/A'}
- Description: ${ctx.company.description ?? 'N/A'}

SOURCE LEAD:
${
  ctx.lead
    ? `- Name: ${ctx.lead.firstName} ${ctx.lead.lastName ?? ''}\n- Source: ${ctx.lead.source ?? 'N/A'}\n- Status: ${ctx.lead.status ?? 'N/A'}\n- Notes: ${ctx.lead.notes ?? 'None'}`
    : '- Not linked'
}

OUR BRAND:
${
  ctx.brand
    ? `- Name: ${ctx.brand.name}\n- Domain: ${ctx.brand.domain ?? 'N/A'}\n- Phone: ${ctx.brand.phone ?? 'N/A'}\n- Logo URL: ${ctx.brand.logoUrl ?? 'N/A'}`
    : '- Brand record missing (tenant has no brand configured)'
}

OUR KNOWLEDGE BASES (RAG context):
${kbLines || '- No knowledge bases configured for this tenant yet.'}

PROPOSAL RECORD FIELDS:
- Proposal Title: ${proposal.title ?? 'Untitled Proposal'}
- Description: ${proposal.description ?? 'N/A'}
- Requirements: ${proposal.requirements ?? 'N/A'}
- Price: ${proposal.price ?? 'N/A'} ${proposal.currency ?? ''}
- Valid Until: ${proposal.validUntil ?? 'N/A'}

USER'S ADDITIONAL INSTRUCTIONS:
${instructions ?? '(none)'}

Now write the complete proposal in Markdown, respecting all rules above. Use ## for section headers. Do not include this instruction text in your output.`;
  }

  private buildFallbackContent(
    proposal: ProposalRecord,
    ctx: any,
    instructions: string | undefined,
    tone: string,
    length: string,
  ): string {
    return `# ${proposal.title ?? 'Business Proposal'} — ${ctx.company.name}

> Proposal generated without active Gemini API key. Please configure GOOGLE_GENAI_API_KEY for full AI-powered generation.

## Introduction
${tone === 'formal' ? 'Dear ' : 'Hi '}${ctx.prospect.firstName}${ctx.prospect.lastName ? ' ' + ctx.prospect.lastName : ''},

Thank you for the opportunity to present this proposal on behalf of ${ctx.brand?.name ?? 'our company'}.

## Understanding of Client Requirements
${
  proposal.requirements ??
  instructions ??
  'Based on our conversation with your team, we have prepared the following proposed solution. Please review and confirm requirements match your expectations.'
}

## Proposed Solution
${ctx.knowledgeBases?.length ? 'Leveraging our documented offerings (see knowledge bases in our system), we propose the following engagement.' : 'Service details to be populated from our knowledge base.'}

## Scope of Work & Deliverables
- Deliverable 1 (TBD — confirm scope)
- Deliverable 2 (TBD — confirm scope)
- Deliverable 3 (TBD — confirm scope)

## Timeline
| Phase | Duration |
|-------|----------|
| Discovery & Planning | 2 weeks |
| Execution | ${length === 'detailed' ? '10 weeks' : length === 'short' ? '4 weeks' : '6 weeks'} |
| Review & Launch | 2 weeks |

## Pricing
Total: **${proposal.price ? proposal.price + ' ' + (proposal.currency ?? 'USD') : '[To be determined]'}**

Valid until: **${proposal.validUntil ? new Date(proposal.validUntil as any).toLocaleDateString() : '30 days from proposal date'}**

## Terms & Conditions
- Standard payment terms: 50% deposit, 50% upon delivery
- Confidentiality: All shared information remains confidential
- Changes in scope handled via written change order

## Next Steps
1. Review proposal and provide feedback within 7 days
2. Schedule a call to discuss any adjustments
3. Sign-off and begin Discovery phase

## Closing
${tone === 'friendly' ? 'Looking forward to working together!' : 'We look forward to a successful partnership.'}

— ${ctx.brand?.name ?? 'Our Team'}  `;
  }
}
