import { Injectable } from '@nestjs/common';
import { and, eq, ilike, or } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { companies } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: companies.id,
  tenantId: companies.tenantId,
  name: companies.name,
  domain: companies.domain,
  website: companies.website,
  industry: companies.industry,
  description: companies.description,
  createdAt: companies.createdAt,
  updatedAt: companies.updatedAt,
} as const;

@Injectable()
export class CompanyRepository {
  async findAllByTenant(tenantId: string, search?: string) {
    if (search && search.trim()) {
      return db
        .select(RETURNING_COLUMNS)
        .from(companies)
        .where(
          and(
            eq(companies.tenantId, tenantId),
            or(
              ilike(companies.name, `%${search.trim()}%`),
              ilike(companies.domain, `%${search.trim()}%`),
              ilike(companies.industry, `%${search.trim()}%`),
            ),
          ),
        );
    }

    return db
      .select(RETURNING_COLUMNS)
      .from(companies)
      .where(eq(companies.tenantId, tenantId));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        domain: true,
        website: true,
        industry: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByNameAndTenant(name: string, tenantId: string) {
    return db.query.companies.findFirst({
      where: and(
        eq(companies.tenantId, tenantId),
        eq(companies.name, name),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    name: string;
    domain?: string;
    website?: string;
    industry?: string;
    description?: string;
  }) {
    const [company] = await db
      .insert(companies)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        domain: input.domain ?? null,
        website: input.website ?? null,
        industry: input.industry ?? null,
        description: input.description ?? null,
      })
      .returning(RETURNING_COLUMNS);

    return company;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      name?: string;
      domain?: string | null;
      website?: string | null;
      industry?: string | null;
      description?: string | null;
    },
  ) {
    const values: Partial<typeof companies.$inferInsert> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.domain !== undefined) values.domain = input.domain;
    if (input.website !== undefined) values.website = input.website;
    if (input.industry !== undefined) values.industry = input.industry;
    if (input.description !== undefined) values.description = input.description;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [company] = await db
      .update(companies)
      .set(values)
      .where(
        and(
          eq(companies.id, id),
          eq(companies.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return company ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(companies)
      .where(
        and(
          eq(companies.id, id),
          eq(companies.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
