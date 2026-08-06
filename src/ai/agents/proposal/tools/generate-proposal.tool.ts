import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

import { ProposalRepository } from '../proposal.repository.js';

@Injectable()
export class GenerateProposalTool extends FunctionTool<any> {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly configService: ConfigService,
  ) {
    super({
      name: 'generate_proposal',
      description:
        'Gather prospect, company, lead, brand and knowledge-base context, then AI-generate the professional proposal content and store it. Set status to generated.',
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
  }

  private async generateWithGemini(
    proposalId: string,
    tenantId: string,
    inputProspectId?: string,
    instructions?: string,
    tone: 'professional' | 'friendly' | 'formal' | 'concise' | 'persuasive' = 'professional',
    length: 'short' | 'medium' | 'detailed' = 'medium',
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
      generatedContent = response?.text?.() ?? this.buildFallbackContent(existing, context, instructions, tone, length);
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
${ctx.lead ? `- Name: ${ctx.lead.firstName} ${ctx.lead.lastName ?? ''}\n- Source: ${ctx.lead.source ?? 'N/A'}\n- Status: ${ctx.lead.status ?? 'N/A'}\n- Notes: ${ctx.lead.notes ?? 'None'}` : '- Not linked'}

OUR BRAND:
${ctx.brand ? `- Name: ${ctx.brand.name}\n- Domain: ${ctx.brand.domain ?? 'N/A'}\n- Phone: ${ctx.brand.phone ?? 'N/A'}\n- Logo URL: ${ctx.brand.logoUrl ?? 'N/A'}` : '- Brand record missing (tenant has no brand configured)'}

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

Now write the complete proposal in Markdown, respecting all rules above. Use ## for section headers. Do not include this instructions text in your output.`;
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
  proposal.requirements ?? instructions ??
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
| Execution | 6 weeks |
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
