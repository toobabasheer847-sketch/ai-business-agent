import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { leads } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: leads.id,
  tenantId: leads.tenantId,
  companyId: leads.companyId,
  firstName: leads.firstName,
  lastName: leads.lastName,
  email: leads.email,
  phone: leads.phone,
  jobTitle: leads.jobTitle,
  source: leads.source,
  status: leads.status,
  notes: leads.notes,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
} as const;

export interface ListLeadsOptions {
  status?: string;
  companyId?: string;
  source?: string;
  search?: string;
}

@Injectable()
export class LeadRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findAllByTenant(tenantId: string, options: ListLeadsOptions = {}) {
    const { status, companyId, source, search } = options;

    const conditions = [eq(leads.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(leads.status, status));
    }

    if (companyId) {
      conditions.push(eq(leads.companyId, companyId));
    }

    if (source) {
      conditions.push(eq(leads.source, source));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(leads.firstName, `%${search.trim()}%`),
          ilike(leads.lastName, `%${search.trim()}%`),
          ilike(leads.email, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.leads.findFirst({
      where: and(
        eq(leads.id, id),
        eq(leads.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        companyId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        source: true,
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
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    source?: string;
    status?: string;
    notes?: string;
  }) {
    const [row] = await this.db
      .insert(leads)
      .values({
        tenantId: input.tenantId,
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        source: input.source ?? null,
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
      firstName?: string;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      source?: string | null;
      status?: string;
      notes?: string | null;
    },
  ) {
    const values: Partial<typeof leads.$inferInsert> = {};

    if (input.companyId !== undefined) values.companyId = input.companyId;
    if (input.firstName !== undefined) values.firstName = input.firstName;
    if (input.lastName !== undefined) values.lastName = input.lastName;
    if (input.email !== undefined) values.email = input.email;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.jobTitle !== undefined) values.jobTitle = input.jobTitle;
    if (input.source !== undefined) values.source = input.source;
    if (input.status !== undefined) values.status = input.status;
    if (input.notes !== undefined) values.notes = input.notes;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(leads)
      .set(values)
      .where(
        and(
          eq(leads.id, id),
          eq(leads.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(leads)
      .where(
        and(
          eq(leads.id, id),
          eq(leads.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
