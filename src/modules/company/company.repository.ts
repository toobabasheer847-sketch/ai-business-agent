import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import type { PageBounds } from '../../common/pagination';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
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
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findAllByTenant(tenantId: string, search?: string, page?: PageBounds) {
    const query = this.db
      .select(RETURNING_COLUMNS)
      .from(companies)
      .where(this.listWhere(tenantId, search))
      .orderBy(desc(companies.createdAt), desc(companies.id));
    if (!page) return query;
    return query.limit(page.limit).offset(page.offset);
  }

  async countByTenant(tenantId: string, search?: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(this.listWhere(tenantId, search));
    return Number(row?.total ?? 0);
  }

  private listWhere(tenantId: string, search?: string) {
    const term = search?.trim();
    if (!term) return eq(companies.tenantId, tenantId);
    return and(
      eq(companies.tenantId, tenantId),
      or(
        ilike(companies.name, `%${term}%`),
        ilike(companies.domain, `%${term}%`),
        ilike(companies.industry, `%${term}%`),
      ),
    );
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        userId: true,
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
    return this.db.query.companies.findFirst({
      where: and(
        eq(companies.tenantId, tenantId),
        eq(companies.name, name),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    userId: string;
    name: string;
    domain?: string;
    website?: string;
    industry?: string;
    description?: string;
  }) {
    const [company] = await this.db
      .insert(companies)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
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

    const [company] = await this.db
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
    const result = await this.db
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
