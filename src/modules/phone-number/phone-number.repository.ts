import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: phoneNumbers.id,
  tenantId: phoneNumbers.tenantId,
  phoneNumber: phoneNumbers.phoneNumber,
  label: phoneNumbers.label,
  provider: phoneNumbers.provider,
  status: phoneNumbers.status,
  createdAt: phoneNumbers.createdAt,
  updatedAt: phoneNumbers.updatedAt,
} as const;

export interface ListPhoneNumbersOptions {
  provider?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class PhoneNumberRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findAllByTenant(tenantId: string, options: ListPhoneNumbersOptions = {}) {
    const { provider, status, search } = options;

    const conditions = [eq(phoneNumbers.tenantId, tenantId)];

    if (provider) {
      conditions.push(eq(phoneNumbers.provider, provider));
    }

    if (status) {
      conditions.push(eq(phoneNumbers.status, status));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(phoneNumbers.phoneNumber, `%${search.trim()}%`),
          ilike(phoneNumbers.label, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(and(...conditions))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findByPhoneNumberAndTenant(phoneNumber: string, tenantId: string) {
    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.phoneNumber, phoneNumber),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async create(input: {
    tenantId: string;
    phoneNumber: string;
    label?: string;
    provider?: string;
    status?: string;
  }) {
    const [row] = await this.db
      .insert(phoneNumbers)
      .values({
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        label: input.label ?? null,
        provider: input.provider ?? 'twilio',
        status: input.status ?? 'active',
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      phoneNumber?: string;
      label?: string | null;
      provider?: string;
      status?: string;
    },
  ) {
    const values: Partial<typeof phoneNumbers.$inferInsert> = {};

    if (input.phoneNumber !== undefined) values.phoneNumber = input.phoneNumber;
    if (input.label !== undefined) values.label = input.label;
    if (input.provider !== undefined) values.provider = input.provider;
    if (input.status !== undefined) values.status = input.status;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(phoneNumbers)
      .set(values)
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
