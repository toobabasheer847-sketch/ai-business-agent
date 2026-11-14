import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { GmailService } from '../communication/gmail/gmail.service.js';
import { ProposalPdfService } from './proposal-pdf.service.js';
import { ProposalRepository } from './proposal.repository.js';
import type { ProposalRecord } from './types/proposal.types.js';

export type ProposalDeliveryResult = {
  messageId: string;
  to: string;
  subject: string;
  fromEmail: string;
  pdfFilename: string;
};

/**
 * Sends proposal PDF via the authenticated tenant's Gmail configuration.
 * Identity and credentials are always server-side.
 */
@Injectable()
export class ProposalDeliveryService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly gmailService: GmailService,
    private readonly proposalPdfService: ProposalPdfService,
  ) {}

  async sendProposalEmail(params: {
    proposal: ProposalRecord;
    tenantId: string;
    userId?: string;
    fromEmail?: string;
  }): Promise<ProposalDeliveryResult> {
    const { proposal, tenantId, userId, fromEmail } = params;

    if (proposal.tenantId !== tenantId) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status === 'sent') {
      throw new BadRequestException('This proposal has already been sent.');
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

    if (!proposal.content?.trim()) {
      throw new BadRequestException(
        'Proposal has no content to send. Generate or add proposal content first.',
      );
    }

    let pdf;
    let brandName: string | undefined;
    try {
      const companyId = await this.proposalRepository.getProspectCompanyId(
        proposal.prospectId,
        tenantId,
      );
      const company = companyId
        ? await this.proposalRepository.getCompany(companyId, tenantId)
        : null;
      const brand = await this.proposalRepository.getBrand(tenantId);
      brandName = brand?.name ?? undefined;
      const prospectName = [prospect.firstName, prospect.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      pdf = await this.proposalPdfService.generateProposalPdf(proposal, {
        companyName: company?.name,
        prospectName: prospectName || undefined,
        brandName,
      });

      await this.proposalRepository.writeAuditLog({
        tenantId,
        userId: userId ?? null,
        action: 'proposal.pdf_generated',
        entityType: 'proposal',
        entityId: proposal.id,
        description: 'Generated proposal PDF for email delivery',
        metadata: { filename: pdf.filename },
      });
    } catch {
      throw new BadRequestException(
        "I couldn't generate the proposal PDF, so the email was not sent.",
      );
    }

    try {
      const creds = await this.gmailService.findActiveCredentialsForTenant(
        tenantId,
        fromEmail,
      );
      if (!creds?.accessToken && !creds?.refreshToken) {
        throw new BadRequestException(
          'Gmail is not configured for this account.',
        );
      }

      const subject = proposal.title?.trim() || 'Business Proposal';
      const body = this.buildEmailBody(creds.email, brandName);
      const sent = await this.gmailService.mailOperations.sendEmail({
        to,
        subject,
        body,
        contentType: 'text/plain',
        attachments: [
          {
            filename: pdf.filename,
            content: pdf.buffer,
            contentType: pdf.contentType,
          },
        ],
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        tokenExpiry: creds.tokenExpiry,
        refreshAccessToken: async (refreshed) => {
          await this.gmailService.refreshAndSave(creds, refreshed);
        },
      });

      await this.proposalRepository.writeAuditLog({
        tenantId,
        userId: userId ?? null,
        action: 'proposal.email_sent',
        entityType: 'proposal',
        entityId: proposal.id,
        description: 'Proposal emailed with PDF attachment',
        metadata: {
          recipient: to,
          messageId: sent.messageId,
          filename: pdf.filename,
        },
      });

      return {
        messageId: sent.messageId,
        to: sent.to,
        subject: sent.subject,
        fromEmail: creds.email,
        pdfFilename: pdf.filename,
      };
    } catch (error) {
      await this.proposalRepository.writeAuditLog({
        tenantId,
        userId: userId ?? null,
        action: 'proposal.email_send_failed',
        entityType: 'proposal',
        entityId: proposal.id,
        description: 'Proposal email send failed',
      }).catch(() => undefined);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "I couldn't send the proposal email right now. The proposal was not marked as sent.",
      );
    }
  }

  private buildEmailBody(fromEmail: string, brandName?: string): string {
    const sender = brandName?.trim() || fromEmail.trim();
    return [
      'Hello,',
      '',
      'Please find attached the requested business proposal.',
      '',
      'Best regards,',
      sender,
    ].join('\n');
  }
}
