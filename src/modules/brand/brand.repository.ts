import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { brands } from '../../database/drizzle/schema';

@Injectable()
export class BrandRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findByTenantId(tenantId: string) {
    return this.db.query.brands.findFirst({
      where: eq(brands.tenantId, tenantId),
    });
  }

  async findById(id: string) {
    return this.db.query.brands.findFirst({
      where: eq(brands.id, id),
    });
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.brands.findFirst({
      where: and(
        eq(brands.id, id),
        eq(brands.tenantId, tenantId),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    name: string;
    logoUrl?: string;
    domain?: string;
    apiUrl?: string;
    phone?: string;
  }) {
    const [brand] = await this.db
      .insert(brands)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        logoUrl: input.logoUrl ?? null,
        domain: input.domain ?? null,
        apiUrl: input.apiUrl ?? null,
        phone: input.phone ?? null,
      })
      .returning({
        id: brands.id,
        tenantId: brands.tenantId,
        name: brands.name,
        logoUrl: brands.logoUrl,
        domain: brands.domain,
        apiUrl: brands.apiUrl,
        phone: brands.phone,
        createdAt: brands.createdAt,
        updatedAt: brands.updatedAt,
      });

    return brand;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      name?: string;
      logoUrl?: string | null;
      domain?: string | null;
      apiUrl?: string | null;
      phone?: string | null;
    },
  ) {
    const values: Partial<typeof brands.$inferInsert> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.logoUrl !== undefined) values.logoUrl = input.logoUrl;
    if (input.domain !== undefined) values.domain = input.domain;
    if (input.apiUrl !== undefined) values.apiUrl = input.apiUrl;
    if (input.phone !== undefined) values.phone = input.phone;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [brand] = await this.db
      .update(brands)
      .set(values)
      .where(
        and(
          eq(brands.id, id),
          eq(brands.tenantId, tenantId),
        ),
      )
      .returning({
        id: brands.id,
        tenantId: brands.tenantId,
        name: brands.name,
        logoUrl: brands.logoUrl,
        domain: brands.domain,
        apiUrl: brands.apiUrl,
        phone: brands.phone,
        createdAt: brands.createdAt,
        updatedAt: brands.updatedAt,
      });

    return brand ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(brands)
      .where(
        and(
          eq(brands.id, id),
          eq(brands.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
