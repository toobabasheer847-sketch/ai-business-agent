import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { companies, leads, prospects } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: prospects.id,
  tenantId: prospects.tenantId,
  companyId: prospects.companyId,
  leadId: prospects.leadId,
  firstName: prospects.firstName,
  lastName: prospects.lastName,
  email: prospects.email,
  phone: prospects.phone,
  jobTitle: prospects.jobTitle,
  status: prospects.status,
  notes: prospects.notes,
  createdAt: prospects.createdAt,
  updatedAt: prospects.updatedAt,
} as const;

export interface ListProspectsOptions {
  status?: string;
  companyId?: string;
  leadId?: string;
  search?: string;
}

@Injectable()
export class ProspectRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  /**
   * Verify a company belongs to the tenant before creating/relating a prospect.
   */
  async findCompanyByIdAndTenant(companyId: string, tenantId: string) {
    return this.db.query.companies.findFirst({
      where: and(
        eq(companies.id, companyId),
        eq(companies.tenantId, tenantId),
      ),
      columns: { id: true },
    });
  }

  /**
   * Verify a lead belongs to the tenant before creating/relating a prospect.
   */
  async findLeadByIdAndTenant(leadId: string, tenantId: string) {
    return this.db.query.leads.findFirst({
      where: and(
        eq(leads.id, leadId),
        eq(leads.tenantId, tenantId),
      ),
      columns: { id: true, companyId: true },
    });
  }

  async findAllByTenant(tenantId: string, options: ListProspectsOptions = {}) {
    const { status, companyId, leadId, search } = options;

    const conditions = [eq(prospects.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(prospects.status, status));
    }

    if (companyId) {
      conditions.push(eq(prospects.companyId, companyId));
    }

    if (leadId) {
      conditions.push(eq(prospects.leadId, leadId));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(prospects.firstName, `%${search.trim()}%`),
          ilike(prospects.lastName, `%${search.trim()}%`),
          ilike(prospects.email, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(prospects)
      .where(and(...conditions))
      .orderBy(desc(prospects.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.prospects.findFirst({
      where: and(
        eq(prospects.id, id),
        eq(prospects.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        companyId: true,
        leadId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    companyId: string;
    leadId: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    status?: string;
    notes?: string;
  }) {
    const [row] = await this.db
      .insert(prospects)
      .values({
        tenantId: input.tenantId,
        companyId: input.companyId,
        leadId: input.leadId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        status: input.status ?? 'new',
        notes: input.notes ?? null,
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      companyId?: string;
      leadId?: string;
      firstName?: string;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      status?: string;
      notes?: string | null;
    },
  ) {
    const values: Partial<typeof prospects.$inferInsert> = {};

    if (input.companyId !== undefined) values.companyId = input.companyId;
    if (input.leadId !== undefined) values.leadId = input.leadId;
    if (input.firstName !== undefined) values.firstName = input.firstName;
    if (input.lastName !== undefined) values.lastName = input.lastName;
    if (input.email !== undefined) values.email = input.email;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.jobTitle !== undefined) values.jobTitle = input.jobTitle;
    if (input.status !== undefined) values.status = input.status;
    if (input.notes !== undefined) values.notes = input.notes;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(prospects)
      .set(values)
      .where(
        and(
          eq(prospects.id, id),
          eq(prospects.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(prospects)
      .where(
        and(
          eq(prospects.id, id),
          eq(prospects.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
