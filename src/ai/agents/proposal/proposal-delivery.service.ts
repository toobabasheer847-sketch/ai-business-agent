import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GmailService } from '../communication/gmail/gmail.service.js';
import { ProposalRepository } from './proposal.repository.js';
import type { ProposalRecord } from './types/proposal.types.js';

export type ProposalDeliveryResult = {
  messageId: string;
  to: string;
  subject: string;
  fromEmail: string;
};

/**
 * Sends proposal content via the authenticated tenant's Gmail configuration.
 * Identity and credentials are always server-side.
 */
@Injectable()
export class ProposalDeliveryService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly gmailService: GmailService,
  ) {}

  async sendProposalEmail(params: {
    proposal: ProposalRecord;
    tenantId: string;
    fromEmail?: string;
  }): Promise<ProposalDeliveryResult> {
    const { proposal, tenantId, fromEmail } = params;

    if (proposal.tenantId !== tenantId) {
      throw new NotFoundException('Proposal not found');
    }

    const prospect = await this.proposalRepository.getProspect(
      proposal.prospectId,
      tenantId,
    );
    if (!prospect) {
      throw new NotFoundException('Prospect not found for this tenant');
    }

    const to = prospect.email?.trim();
    if (!to) {
      throw new BadRequestException(
        'Prospect has no email address. Add a prospect email before sending the proposal.',
      );
    }

    const body = this.buildEmailBody(proposal);
    if (!body.trim()) {
      throw new BadRequestException(
        'Proposal has no content to send. Generate or add proposal content first.',
      );
    }

    const creds = await this.gmailService.findActiveCredentialsForTenant(
      tenantId,
      fromEmail,
    );
    if (!creds?.accessToken && !creds?.refreshToken) {
      throw new BadRequestException(
        'No active Gmail configuration for this tenant. Connect Gmail before sending proposals.',
      );
    }

    const subject = proposal.title?.trim() || 'Business Proposal';

    const sent = await this.gmailService.mailOperations.sendEmail({
      to,
      subject,
      body,
      contentType: 'text/plain',
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      tokenExpiry: creds.tokenExpiry,
      refreshAccessToken: async (refreshed) => {
        await this.gmailService.refreshAndSave(creds, refreshed);
      },
    });

    return {
      messageId: sent.messageId,
      to: sent.to,
      subject: sent.subject,
      fromEmail: creds.email,
    };
  }

  private buildEmailBody(proposal: ProposalRecord): string {
    if (proposal.content?.trim()) {
      return proposal.content.trim();
    }

    const parts: string[] = [];
    if (proposal.title) {
      parts.push(proposal.title);
      parts.push('');
    }
    if (proposal.description?.trim()) {
      parts.push(proposal.description.trim());
    }
    if (proposal.requirements?.trim()) {
      parts.push('');
      parts.push('Requirements:');
      parts.push(proposal.requirements.trim());
    }
    if (proposal.price != null && proposal.price !== '') {
      parts.push('');
      parts.push(`Price: ${proposal.price} ${proposal.currency ?? 'USD'}`);
    }
    return parts.join('\n');
  }
}
