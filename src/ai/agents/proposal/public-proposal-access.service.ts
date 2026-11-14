import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProposalPdfService, type ProposalPdfResult } from './proposal-pdf.service.js';
import { ProposalRepository } from './proposal.repository.js';
import { splitProposalSections } from './proposal-sections.js';
import {
  generateProposalAccessToken,
  hashProposalAccessToken,
  isWellFormedProposalToken,
} from './proposal-access-token.js';
import type { ProposalRecord, ProposalStatus } from './types/proposal.types.js';

const LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type PublicProposalBrand = {
  name: string | null;
  logoUrl: string | null;
  domain: string | null;
  phone: string | null;
};

export type PublicProposalView = {
  title: string;
  description: string | null;
  requirements: string | null;
  content: string | null;
  sections: Array<{ heading: string; body: string }>;
  price: string | null;
  currency: string;
  validUntil: string | null;
  status: ProposalStatus;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  pdfAvailable: boolean;
  linkExpiresAt: string;
  brand: PublicProposalBrand;
  companyName: string | null;
};

type AccessRow = {
  id: string;
  tenantId: string;
  proposalId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

@Injectable()
export class PublicProposalAccessService {
  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly proposalPdfService: ProposalPdfService,
    private readonly configService: ConfigService,
  ) {}

  async issueForDelivery(
    proposal: ProposalRecord,
    tenantId: string,
  ): Promise<{ url: string; expiresAt: Date; tokenId: string }> {
    if (proposal.tenantId !== tenantId) {
      throw new NotFoundException('Proposal not found');
    }

    const token = generateProposalAccessToken();
    const tokenHash = hashProposalAccessToken(token);
    const expiresAt = this.resolveExpiry(proposal);
    const issued = await this.proposalRepository.issueProposalAccessToken({
      tenantId,
      proposalId: proposal.id,
      tokenHash,
      expiresAt,
    });

    await this.safeAudit(tenantId, proposal.id, 'proposal.public_link_issued', {
      expiresAt: issued.expiresAt.toISOString(),
    });

    return {
      url: `${this.publicBaseUrl()}/p/${token}`,
      expiresAt: issued.expiresAt,
      tokenId: issued.id,
    };
  }

  async revokeIssued(tokenId: string, tenantId: string, proposalId: string): Promise<void> {
    await this.proposalRepository.revokeProposalAccessToken(tokenId, tenantId);
    await this.safeAudit(tenantId, proposalId, 'proposal.public_link_revoked', {});
  }

  async getProposal(rawToken: string): Promise<PublicProposalView> {
    const { access, proposal } = await this.resolve(rawToken);
    this.assertStillValid(proposal);

    let current = proposal;
    if (current.status === 'sent' && !current.viewedAt) {
      const viewed = await this.proposalRepository.markProposalViewedIfFirst(
        current.id,
        access.tenantId,
      );
      if (viewed) {
        current = viewed;
        await this.safeAudit(access.tenantId, current.id, 'proposal.public_viewed', {
          status: 'viewed',
        });
      } else {
        const refreshed = await this.proposalRepository.getProposal(current.id, access.tenantId);
        if (refreshed) {
          current = refreshed;
        }
      }
    }

    return this.toPublicView(current, access);
  }

  async accept(rawToken: string): Promise<PublicProposalView> {
    const { access, proposal } = await this.resolve(rawToken);
    this.assertStillValid(proposal);

    const updated = await this.proposalRepository.markProposalAcceptedIfOpen(
      proposal.id,
      access.tenantId,
    );
    if (!updated) {
      throw new ConflictException('This proposal can no longer be accepted.');
    }

    await this.safeAudit(access.tenantId, updated.id, 'proposal.public_accepted', {
      status: 'accepted',
    });
    return this.toPublicView(updated, access);
  }

  async reject(rawToken: string, reason: string): Promise<PublicProposalView> {
    const cleaned = reason?.trim() ?? '';
    if (!cleaned || cleaned.length > 500) {
      throw new BadRequestException('A rejection reason up to 500 characters is required.');
    }

    const { access, proposal } = await this.resolve(rawToken);
    this.assertStillValid(proposal);

    const updated = await this.proposalRepository.markProposalRejectedIfOpen(
      proposal.id,
      access.tenantId,
      cleaned,
    );
    if (!updated) {
      throw new ConflictException('This proposal can no longer be rejected.');
    }

    await this.safeAudit(access.tenantId, updated.id, 'proposal.public_rejected', {
      status: 'rejected',
    });
    return this.toPublicView(updated, access);
  }

  async downloadPdf(rawToken: string): Promise<ProposalPdfResult> {
    const { access, proposal } = await this.resolve(rawToken);
    this.assertStillValid(proposal);
    if (!proposal.content?.trim()) {
      throw new NotFoundException('Proposal PDF is not available.');
    }

    const companyName = await this.companyName(proposal.prospectId, access.tenantId);
    const brand = await this.proposalRepository.getBrand(access.tenantId);
    const prospect = await this.proposalRepository.getProspect(proposal.prospectId, access.tenantId);
    const prospectName = [prospect?.firstName, prospect?.lastName].filter(Boolean).join(' ').trim();

    return this.proposalPdfService.generateProposalPdf(proposal, {
      companyName,
      prospectName: prospectName || undefined,
      brandName: brand?.name,
      includeReference: false,
    });
  }

  private async resolve(rawToken: string): Promise<{ access: AccessRow; proposal: ProposalRecord }> {
    const token = rawToken?.trim() ?? '';
    if (!isWellFormedProposalToken(token)) {
      throw new NotFoundException('Proposal link not found');
    }

    const access = await this.proposalRepository.findProposalAccessByHash(
      hashProposalAccessToken(token),
    );
    if (!access) {
      throw new NotFoundException('Proposal link not found');
    }
    if (access.revokedAt) {
      throw new GoneException('This proposal link is no longer active.');
    }
    if (access.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('This proposal link has expired.');
    }

    const proposal = await this.proposalRepository.getProposal(access.proposalId, access.tenantId);
    if (!proposal || proposal.tenantId !== access.tenantId) {
      throw new NotFoundException('Proposal link not found');
    }

    return { access, proposal };
  }

  private assertStillValid(proposal: ProposalRecord): void {
    if (proposal.status === 'expired' || this.isPastValidUntil(proposal)) {
      throw new GoneException('This proposal is no longer valid.');
    }
  }

  private isPastValidUntil(proposal: ProposalRecord): boolean {
    if (!proposal.validUntil) {
      return false;
    }
    const validUntil = new Date(proposal.validUntil);
    return !Number.isNaN(validUntil.getTime()) && validUntil.getTime() <= Date.now();
  }

  private resolveExpiry(proposal: ProposalRecord): Date {
    const fallback = new Date(Date.now() + LINK_TTL_MS);
    if (!proposal.validUntil) {
      return fallback;
    }
    const validUntil = new Date(proposal.validUntil);
    if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      return fallback;
    }
    return validUntil.getTime() < fallback.getTime() ? validUntil : fallback;
  }

  private publicBaseUrl(): string {
    const configured = this.configService.get<string>('APP_PUBLIC_URL')?.trim();
    return (configured || 'http://localhost:5173').replace(/\/+$/, '');
  }

  private async companyName(prospectId: string, tenantId: string): Promise<string | null> {
    const companyId = await this.proposalRepository.getProspectCompanyId(prospectId, tenantId);
    if (!companyId) {
      return null;
    }
    const company = await this.proposalRepository.getCompany(companyId, tenantId);
    return company?.name ?? null;
  }

  private async toPublicView(proposal: ProposalRecord, access: AccessRow): Promise<PublicProposalView> {
    const brand = await this.proposalRepository.getBrand(access.tenantId);
    const companyName = await this.companyName(proposal.prospectId, access.tenantId);
    const price =
      proposal.price === null || proposal.price === undefined || proposal.price === ''
        ? null
        : String(proposal.price);

    return {
      title: proposal.title,
      description: proposal.description ?? null,
      requirements: proposal.requirements ?? null,
      content: proposal.content ?? null,
      sections: splitProposalSections(proposal.content),
      price,
      currency: proposal.currency || 'USD',
      validUntil: toIso(proposal.validUntil),
      status: proposal.status,
      viewedAt: toIso(proposal.viewedAt),
      acceptedAt: toIso(proposal.acceptedAt),
      rejectedAt: toIso(proposal.rejectedAt),
      rejectionReason: proposal.rejectionReason ?? null,
      pdfAvailable: Boolean(proposal.content?.trim()),
      linkExpiresAt: access.expiresAt.toISOString(),
      brand: {
        name: brand?.name ?? null,
        logoUrl: brand?.logoUrl ?? null,
        domain: brand?.domain ?? null,
        phone: brand?.phone ?? null,
      },
      companyName,
    };
  }

  private async safeAudit(
    tenantId: string,
    proposalId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.proposalRepository.writeAuditLog({
        tenantId,
        userId: null,
        action,
        entityType: 'proposal',
        entityId: proposalId,
        description: action,
        metadata,
      });
    } catch (error) {
      console.error('Public proposal audit write failed (non-fatal)', error);
    }
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
