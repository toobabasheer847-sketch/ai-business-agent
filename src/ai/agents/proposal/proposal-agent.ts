import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { ProposalRepository } from './proposal.repository.js';
import {
  ProposalAgentResponse,
  ProposalContext,
  ProposalStatus,
  ProposalTone,
  ProposalLength,
} from './types/proposal.types.js';

@Injectable()
export class ProposalAgent {
  private readonly agent: any | null;

  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly configService: ConfigService,
  ) {
    const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    if (!apiKey) {
      this.agent = null;
      return;
    }

    const { FunctionTool } = require('@google/adk');

    const createProposalTool = new FunctionTool({
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

    const getProposalTool = new FunctionTool({
      name: 'get_proposal',
      description: 'Fetch a single tenant-scoped proposal by id.',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) =>
        this.proposalRepository.getProposal(input.proposalId, input.tenantId),
    });

    const listProposalsTool = new FunctionTool({
      name: 'list_proposals',
      description:
        'List tenant-scoped proposals. Optionally filter by status, prospectId, or search by title/description.',
      parameters: z.object({
        tenantId: z.string(),
        status: z
          .enum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'])
          .optional(),
        prospectId: z.string().optional(),
        search: z.string().optional(),
      }),
      execute: async (input: any) =>
        this.proposalRepository.listProposals(input.tenantId, {
          status: input.status,
          prospectId: input.prospectId,
          search: input.search,
        }),
    });

    const updateProposalTool = new FunctionTool({
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

    const generateProposalTool = new FunctionTool({
      name: 'generate_proposal',
      description:
        'AI-generate the full professional proposal content using prospect/company/brand/knowledge context and update the proposal record.',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
        prospectId: z.string().optional(),
        instructions: z.string().optional(),
        tone: z.enum(['professional', 'friendly', 'formal', 'concise', 'persuasive']).optional(),
        length: z.enum(['short', 'medium', 'detailed']).optional(),
      }),
      execute: async (input: any) =>
        this.generateWithGemini(
          input.proposalId,
          input.tenantId,
          input.prospectId,
          input.instructions,
          input.tone,
          input.length,
        ),
    });

    const changeProposalStatusTool = new FunctionTool({
      name: 'change_proposal_status',
      description:
        'Transition a proposal to a new status. Sets sentAt/viewedAt/acceptedAt/rejectedAt timestamps automatically when applicable.',
      parameters: z.object({
        proposalId: z.string(),
        tenantId: z.string(),
        status: z.enum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled']),
      }),
      execute: async (input: any) => {
        const status: ProposalStatus = input.status;
        const update: any = { status };
        const now = new Date().toISOString();
        if (status === 'sent') update.sentAt = now;
        if (status === 'viewed') update.viewedAt = now;
        if (status === 'accepted') update.acceptedAt = now;
        if (status === 'rejected') update.rejectedAt = now;
        return this.proposalRepository.updateProposal(input.proposalId, input.tenantId, update);
      },
    });

    this.agent = this.createAgent(modelName, apiKey, [
      createProposalTool,
      getProposalTool,
      listProposalsTool,
      updateProposalTool,
      generateProposalTool,
      changeProposalStatusTool,
    ]);
  }

  private createAgent(modelName: string, apiKey: string, tools: any[]) {
    const { LlmAgent, Gemini } = require('@google/adk');

    return new LlmAgent({
      name: 'proposal_agent',
      model: new Gemini({
        model: modelName,
        apiKey,
      }),
      instruction:
        "You are a professional, tenant-aware business proposal assistant for a B2B AI Business Agent platform. Use the provided tools to create, read, list, update, AI-generate, and transition proposals. CRITICAL SECURITY: Never cross tenant boundaries — every tool call must include the provided tenantId. When a user says 'create a proposal' without full details, prefer to: 1) extract prospect/company names, 2) if no prospect id given, politely ask for a valid prospectId (do not guess or fabricate IDs), 3) always populate title, requirements, and price from the user's wording. When the user asks to 'generate' a proposal, call generate_proposal (not update) so context gathering + LLM content creation run. Mark proposals generated after AI fills content, not before. Do not hallucinate pricing, company facts, or service lists — rely on provided context from knowledge bases, brand, company, prospect, and lead records. If facts are missing, flag them clearly in the generated content with [TBD] markers and state which data is missing so the user can fill it in.",
      tools,
    });
  }

  async processRequest(
    context: ProposalContext,
    request: string,
  ): Promise<ProposalAgentResponse> {
    const fallback = this.parseNaturalLanguage(request, context);

    if (this.agent) {
      try {
        const { FunctionCallingConfig, ToolCall } = require('@google/adk');
        const session = await this.agent.newSession?.();
        const agentContext = {
          userId: context.userId,
          tenantId: context.tenantId,
          email: context.email ?? null,
        };

        const result = session
          ? await session.start({
              request,
              context: agentContext,
            })
          : await this.agent.execute?.({ request, context: agentContext });

        const text = result?.text?.();
        const toolCallResults = result?.toolCallResults ?? [];

        if (toolCallResults && toolCallResults.length > 0) {
          const lastResult = toolCallResults[toolCallResults.length - 1];
          const name = lastResult?.toolName ?? fallback.action;
          const actionName = this.toolNameToAction(name);
          return {
            action: actionName,
            data: lastResult?.result ?? null,
            message: text ?? 'Proposal action executed.',
          };
        }

        if (text) {
          return {
            action: fallback.action,
            data: fallback.data,
            message: text,
          };
        }
      } catch (err) {
        console.error('ProposalAgent ADK execute failed, using fallback', err);
      }
    }

    return this.runFallback(fallback, context);
  }

  private toolNameToAction(name: string): ProposalAgentResponse['action'] {
    switch (name) {
      case 'create_proposal':
        return 'create';
      case 'get_proposal':
        return 'get';
      case 'list_proposals':
        return 'list';
      case 'update_proposal':
        return 'update';
      case 'generate_proposal':
        return 'generate';
      case 'change_proposal_status':
        return 'change_status';
      default:
        return 'get';
    }
  }

  private async runFallback(fallback: any, context: ProposalContext): Promise<ProposalAgentResponse> {
    if (fallback.action === 'create') {
      const created = await this.proposalRepository.createProposal({
        tenantId: context.tenantId,
        createdBy: context.userId,
        prospectId: fallback.data.prospectId,
        title: fallback.data.title,
        description: fallback.data.description,
        requirements: fallback.data.requirements,
        price: fallback.data.price,
        currency: fallback.data.currency,
        validUntil: fallback.data.validUntil,
      });
      return { action: 'create', data: created, message: 'Proposal created (fallback parser).' };
    }

    if (fallback.action === 'list') {
      const rows = await this.proposalRepository.listProposals(context.tenantId, {
        status: fallback.data.status,
        prospectId: fallback.data.prospectId,
      });
      return { action: 'list', data: rows, message: 'Proposals retrieved (fallback parser).' };
    }

    if (fallback.action === 'get' && fallback.data.id) {
      const row = await this.proposalRepository.getProposal(fallback.data.id, context.tenantId);
      return { action: 'get', data: row ?? null, message: row ? 'Proposal retrieved.' : 'Proposal not found.' };
    }

    if (fallback.action === 'change_status' && fallback.data.id) {
      const status: ProposalStatus = fallback.data.status;
      const update: any = { status };
      const now = new Date().toISOString();
      if (status === 'sent') update.sentAt = now;
      if (status === 'viewed') update.viewedAt = now;
      if (status === 'accepted') update.acceptedAt = now;
      if (status === 'rejected') update.rejectedAt = now;
      const updated = await this.proposalRepository.updateProposal(
        fallback.data.id,
        context.tenantId,
        update,
      );
      return {
        action: 'change_status',
        data: updated,
        message: updated ? `Proposal status changed to ${status}.` : 'Proposal not found.',
      };
    }

    if (fallback.action === 'generate' && fallback.data.id) {
      const updated = await this.generateWithGemini(
        fallback.data.id,
        context.tenantId,
        fallback.data.prospectId,
        fallback.data.instructions,
        fallback.data.tone,
        fallback.data.length,
      );
      return {
        action: 'generate',
        data: updated,
        message: updated ? 'Proposal content generated.' : 'Proposal not found for generation.',
      };
    }

    if (fallback.action === 'update' && fallback.data.id) {
      const updated = await this.proposalRepository.updateProposal(
        fallback.data.id,
        context.tenantId,
        fallback.data.updateInput,
      );
      return {
        action: 'update',
        data: updated,
        message: updated ? 'Proposal updated.' : 'Proposal not found.',
      };
    }

    return { action: 'get', data: null, message: 'Proposal request could not be understood. Please rephrase including prospectId and intended action.' };
  }

  private parseNaturalLanguage(request: string, context: ProposalContext): any {
    const lower = request.toLowerCase();

    const id = this.extractId(request);

    if (lower.includes('status') || lower.includes('mark as') || lower.includes('accept') || lower.includes('reject') || lower.includes('send') || lower.includes('view') || lower.includes('cancel') || lower.includes('expire')) {
      let status: ProposalStatus | undefined;
      if (lower.includes('accept')) status = 'accepted';
      else if (lower.includes('reject')) status = 'rejected';
      else if (lower.includes('send')) status = 'sent';
      else if (lower.includes('view')) status = 'viewed';
      else if (lower.includes('cancel')) status = 'cancelled';
      else if (lower.includes('expire')) status = 'expired';
      else if (lower.includes('draft')) status = 'draft';
      else if (lower.includes('generated')) status = 'generated';
      return {
        action: 'change_status',
        data: { id, status },
      };
    }

    if (lower.includes('generate') || lower.includes('write') || lower.includes('compose') || (lower.includes('create') && (lower.includes('professional') || lower.includes('content')))) {
      const prospectIdMatch = request.match(/prospect(?:id)?[:\s-]+([a-f0-9-]{8,})/i);
      const toneMatch: any = lower.match(/(professional|friendly|formal|concise|persuasive)/);
      const lengthMatch: any = lower.match(/(short|medium|detailed)/);
      return {
        action: id ? 'generate' : 'create',
        data: {
          id,
          prospectId: prospectIdMatch ? prospectIdMatch[1] : undefined,
          instructions: request.replace(/^(please\s+)?(generate|write|compose|create)\s+(a\s+)?(proposal|business proposal)/i, '').trim() || undefined,
          tone: (toneMatch?.[0] as ProposalTone) ?? undefined,
          length: (lengthMatch?.[0] as ProposalLength) ?? undefined,
          title: `Proposal — ${new Date().toLocaleDateString()}`,
          description: request,
          requirements: request,
        },
      };
    }

    if (lower.includes('show') || lower.includes('list') || lower.includes('my drafts') || lower.includes('draft proposals') || lower.includes('proposals for')) {
      let status: ProposalStatus | undefined;
      if (lower.includes('draft')) status = 'draft';
      else if (lower.includes('sent')) status = 'sent';
      else if (lower.includes('accepted')) status = 'accepted';
      else if (lower.includes('rejected')) status = 'rejected';
      const prospectIdMatch = request.match(/prospect(?:id)?[:\s-]+([a-f0-9-]{8,})/i);
      return {
        action: 'list',
        data: {
          status,
          prospectId: prospectIdMatch ? prospectIdMatch[1] : undefined,
        },
      };
    }

    if (lower.includes('price') && (lower.includes('update') || lower.includes('change') || lower.includes('set'))) {
      const priceMatch = request.match(/\$?([\d]+(?:\.[\d]{1,2})?)/);
      const updateInput: any = {};
      if (priceMatch) updateInput.price = Number(priceMatch[1]);
      const currencyMatch = request.match(/\b(USD|EUR|GBP|INR|CAD|AUD|JPY)\b/);
      if (currencyMatch) updateInput.currency = currencyMatch[0];
      return {
        action: 'update',
        data: { id, updateInput },
      };
    }

    if (lower.includes('create') || lower.includes('new proposal') || lower.includes('make a proposal')) {
      const prospectIdMatch = request.match(/prospect(?:id)?[:\s-]+([a-f0-9-]{8,})/i);
      const titleFromContext = this.extractCompanyAdjective(request) ?? 'Untitled Proposal';
      return {
        action: 'create',
        data: {
          prospectId: prospectIdMatch ? prospectIdMatch[1] : undefined,
          title: titleFromContext,
          description: request,
          requirements: request,
        },
      };
    }

    return {
      action: 'get',
      data: { id },
    };
  }

  private extractCompanyAdjective(request: string): string | undefined {
    const forMatch = request.match(/for\s+([A-Za-z0-9 ]+?)(?:company|corp|inc|ltd|llc|\.|,|$)/i);
    if (forMatch?.[1]) {
      const name = forMatch[1].trim();
      if (name.length >= 2) return `Proposal for ${name}`;
    }
    return undefined;
  }

  private extractId(request: string): string | undefined {
    const match = request.match(/([a-f0-9-]{8,})/i);
    return match ? match[1] : undefined;
  }

  private async generateWithGemini(
    proposalId: string,
    tenantId: string,
    inputProspectId?: string,
    instructions?: string,
    tone: ProposalTone = 'professional',
    length: ProposalLength = 'medium',
  ) {
    const existing = await this.proposalRepository.getProposal(proposalId, tenantId);
    if (!existing) return null;

    const prospectId = inputProspectId ?? existing.prospectId;
    const context = await this.proposalRepository.gatherGenerationContext(prospectId, tenantId);
    if (!context) return null;

    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');

    let generatedContent: string;
    if (!apiKey) {
      generatedContent = this.buildFallbackContent(existing, context, instructions, tone, length);
    } else {
      const { Gemini } = require('@google/adk');
      const model = new Gemini({ model: modelName, apiKey });
      const prompt = this.buildPrompt(existing, context, instructions, tone, length);
      const response = await model.generateContent(prompt);
      generatedContent =
        response?.text?.() ??
        this.buildFallbackContent(existing, context, instructions, tone, length);
    }

    const update: any = {
      content: generatedContent,
      status: 'generated',
    };

    if (instructions && !existing.requirements) {
      update.requirements = instructions;
    }

    const updated = await this.proposalRepository.updateProposal(proposalId, tenantId, update);
    return updated;
  }

  private buildPrompt(
    proposal: any,
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
- For validity/expiry, use ${proposal.validUntil ? new Date(proposal.validUntil).toISOString() : 'NOT SPECIFIED.'}.

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

OUR KNOWLEDGE BASES:
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
    proposal: any,
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

Valid until: **${proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString() : '30 days from proposal date'}**

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
