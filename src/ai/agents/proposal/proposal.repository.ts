import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, lt, ne, SQL, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { proposals } from '../../../database/drizzle/schema/proposal.schema.js';
import { prospects } from '../../../database/drizzle/schema/prospect.schema.js';
import { companies } from '../../../database/drizzle/schema/company.schema.js';
import { leads } from '../../../database/drizzle/schema/lead.schema.js';
import { brands } from '../../../database/drizzle/schema/brand.schema.js';
import { knowledgebases } from '../../../database/drizzle/schema/knowledgebase.schema.js';
import { auditLogs } from '../../../database/drizzle/schema/audit-log.schema.js';
import {
  BrandContext,
  CompanyContext,
  KnowledgeContextItem,
  LeadContext,
  ProposalGenerationContext,
  ProspectContext,
  ProposalRecord,
  ProposalStatus,
} from './types/proposal.types.js';

@Injectable()
export class ProposalRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async createProposal(input: {
    tenantId: string;
    prospectId: string;
    createdBy?: string | null;
    title: string;
    description?: string | null;
    requirements?: string | null;
    status?: ProposalStatus;
    price?: number | string | null;
    currency?: string;
    validUntil?: Date | string | null;
    content?: string | null;
  }): Promise<ProposalRecord> {
    const priceValue: string | null =
      input.price === null || input.price === undefined
        ? null
        : typeof input.price === 'number'
          ? String(input.price)
          : input.price;

    const [row] = await this.db
      .insert(proposals)
      .values({
        tenantId: input.tenantId,
        prospectId: input.prospectId,
        createdBy: input.createdBy ?? null,
        title: input.title,
        description: input.description ?? null,
        requirements: input.requirements ?? null,
        status: (input.status ?? 'draft'),
        price: priceValue,
        currency: input.currency ?? 'USD',
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        content: input.content ?? null,
      })
      .returning();

    return this.mapRow(row);
  }

  async getProposal(proposalId: string, tenantId: string): Promise<ProposalRecord | null> {
    const [row] = await this.db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
      .limit(1);
    return row ? this.mapRow(row) : null;
  }

  async listProposals(
    tenantId: string,
    filters?: { status?: ProposalStatus; prospectId?: string; search?: string },
  ): Promise<ProposalRecord[]> {
    const clauses: SQL[] = [eq(proposals.tenantId, tenantId)];

    if (filters?.status) {
      clauses.push(eq(proposals.status, filters.status));
    }

    if (filters?.prospectId) {
      clauses.push(eq(proposals.prospectId, filters.prospectId));
    }

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      clauses.push(
        sql`${proposals.title} ILIKE ${pattern} OR ${proposals.description} ILIKE ${pattern} OR ${proposals.content} ILIKE ${pattern}`,
      );
    }

    const rows = await this.db
      .select()
      .from(proposals)
      .where(and(...clauses))
      .orderBy(desc(proposals.createdAt));
    return rows.map((row) => this.mapRow(row));
  }

  async updateProposal(
    proposalId: string,
    tenantId: string,
    input: Partial<
      Pick<
        ProposalRecord,
        | 'prospectId'
        | 'title'
        | 'description'
        | 'requirements'
        | 'status'
        | 'price'
        | 'currency'
        | 'validUntil'
        | 'content'
        | 'sentAt'
        | 'viewedAt'
        | 'acceptedAt'
        | 'rejectedAt'
      >
    >,
  ): Promise<ProposalRecord | null> {
    let priceValue: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(input, 'price')) {
      priceValue =
        input.price === null || input.price === undefined
          ? null
          : typeof input.price === 'number'
            ? String(input.price)
            : input.price;
    }

    const [row] = await this.db
      .update(proposals)
      .set({
        prospectId: input.prospectId,
        title: input.title,
        description: input.description,
        requirements: input.requirements,
        status: input.status,
        price: priceValue,
        currency: input.currency,
        validUntil: input.validUntil ? new Date(input.validUntil) : input.validUntil === null ? null : undefined,
        content: input.content,
        sentAt: input.sentAt ? new Date(input.sentAt) : input.sentAt === null ? null : undefined,
        viewedAt: input.viewedAt ? new Date(input.viewedAt) : input.viewedAt === null ? null : undefined,
        acceptedAt: input.acceptedAt ? new Date(input.acceptedAt) : input.acceptedAt === null ? null : undefined,
        rejectedAt: input.rejectedAt ? new Date(input.rejectedAt) : input.rejectedAt === null ? null : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
      .returning();

    return row ? this.mapRow(row) : null;
  }

  async deleteProposal(proposalId: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getProspect(prospectId: string, tenantId: string): Promise<ProspectContext | null> {
    const [row] = await this.db
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      jobTitle: row.jobTitle,
      status: row.status,
      notes: row.notes,
    };
  }

  async getCompany(companyId: string, tenantId: string): Promise<CompanyContext | null> {
    const [row] = await this.db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      website: row.website,
      industry: row.industry,
      description: row.description,
    };
  }

  async getLead(leadId: string, tenantId: string): Promise<LeadContext | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      jobTitle: row.jobTitle,
      source: row.source,
      status: row.status,
      notes: row.notes,
    };
  }

  async getBrand(tenantId: string): Promise<BrandContext | null> {
    const [row] = await this.db
      .select()
      .from(brands)
      .where(eq(brands.tenantId, tenantId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      logoUrl: row.logoUrl,
      domain: row.domain,
      apiUrl: row.apiUrl,
      phone: row.phone,
    };
  }

  async listKnowledgeBases(tenantId: string, limit = 20): Promise<KnowledgeContextItem[]> {
    const rows = await this.db
      .select()
      .from(knowledgebases)
      .where(eq(knowledgebases.tenantId, tenantId))
      .orderBy(desc(knowledgebases.updatedAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
    }));
  }

  async getProspectCompanyId(prospectId: string, tenantId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ companyId: prospects.companyId })
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId)))
      .limit(1);
    return row?.companyId ?? null;
  }

  async getProspectLeadId(prospectId: string, tenantId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ leadId: prospects.leadId })
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId)))
      .limit(1);
    return row?.leadId ?? null;
  }

  async gatherGenerationContext(
    prospectId: string,
    tenantId: string,
  ): Promise<ProposalGenerationContext | null> {
    const prospect = await this.getProspect(prospectId, tenantId);
    if (!prospect) return null;

    const companyId = await this.getProspectCompanyId(prospectId, tenantId);
    const leadId = await this.getProspectLeadId(prospectId, tenantId);

    const [company, lead, brand, knowledgeBases] = await Promise.all([
      companyId ? this.getCompany(companyId, tenantId) : Promise.resolve(null),
      leadId ? this.getLead(leadId, tenantId) : Promise.resolve(null),
      this.getBrand(tenantId),
      this.listKnowledgeBases(tenantId, 25),
    ]);

    if (!company) {
      return null;
    }

    return {
      prospect,
      company,
      lead: lead ?? null,
      brand: brand ?? null,
      knowledgeBases,
    };
  }

  async writeAuditLog(input: {
    tenantId: string;
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async listTenantIdsWithStaleSentProposals(beforeDate: Date): Promise<string[]> {
    const sentStatus: ProposalStatus = 'sent';
    const expiredStatus: ProposalStatus = 'expired';
    const rows = await this.db
      .selectDistinct({ tenantId: proposals.tenantId })
      .from(proposals)
      .where(and(
        eq(proposals.status, sentStatus),
        isNotNull(proposals.validUntil),
        lt(proposals.validUntil, beforeDate),
        ne(proposals.status, expiredStatus),
      ));
    return rows.map((row) => row.tenantId);
  }

  async expireSentProposalsForTenant(tenantId: string, beforeDate: Date): Promise<number> {
    const sentStatus: ProposalStatus = 'sent';
    const expiredStatus: ProposalStatus = 'expired';
    const now = new Date();
    const result = await this.db
      .update(proposals)
      .set({
        status: expiredStatus,
        updatedAt: now,
      })
      .where(and(
        eq(proposals.tenantId, tenantId),
        eq(proposals.status, sentStatus),
        isNotNull(proposals.validUntil),
        lt(proposals.validUntil, beforeDate),
        ne(proposals.status, expiredStatus),
      ));
    return Number(result.rowCount ?? 0);
  }

  private mapRow(row: Record<string, unknown>): ProposalRecord {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      prospectId: row.prospectId as string,
      createdBy: (row.createdBy as string | null) ?? null,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      requirements: (row.requirements as string | null) ?? null,
      status: row.status as ProposalStatus,
      price: (row.price as string | number | null) ?? null,
      currency: (row.currency as string) ?? 'USD',
      validUntil: (row.validUntil as Date | string | null) ?? null,
      content: (row.content as string | null) ?? null,
      sentAt: (row.sentAt as Date | string | null) ?? null,
      viewedAt: (row.viewedAt as Date | string | null) ?? null,
      acceptedAt: (row.acceptedAt as Date | string | null) ?? null,
      rejectedAt: (row.rejectedAt as Date | string | null) ?? null,
      createdAt: (row.createdAt as Date | string | null) ?? null,
      updatedAt: (row.updatedAt as Date | string | null) ?? null,
    };
  }
}
