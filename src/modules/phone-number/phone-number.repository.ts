import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { phoneNumbers } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: phoneNumbers.id,
  tenantId: phoneNumbers.tenantId,
  phoneNumber: phoneNumbers.phoneNumber,
  label: phoneNumbers.label,
  provider: phoneNumbers.provider,
  status: phoneNumbers.status,
  description: phoneNumbers.description,
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
          ilike(phoneNumbers.description, `%${search.trim()}%`),
        )!,
      );
    }

    return db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(and(...conditions))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.phoneNumbers.findFirst({
      where: and(
        eq(phoneNumbers.id, id),
        eq(phoneNumbers.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        phoneNumber: true,
        label: true,
        provider: true,
        status: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByPhoneNumberAndTenant(phoneNumber: string, tenantId: string) {
    return db.query.phoneNumbers.findFirst({
      where: and(
        eq(phoneNumbers.phoneNumber, phoneNumber),
        eq(phoneNumbers.tenantId, tenantId),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    phoneNumber: string;
    label?: string;
    provider?: string;
    status?: string;
    description?: string;
  }) {
    const [row] = await db
      .insert(phoneNumbers)
      .values({
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        label: input.label ?? null,
        provider: input.provider ?? 'twilio',
        status: input.status ?? 'active',
        description: input.description ?? null,
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
      description?: string | null;
    },
  ) {
    const values: Partial<typeof phoneNumbers.$inferInsert> = {};

    if (input.phoneNumber !== undefined) values.phoneNumber = input.phoneNumber;
    if (input.label !== undefined) values.label = input.label;
    if (input.provider !== undefined) values.provider = input.provider;
    if (input.status !== undefined) values.status = input.status;
    if (input.description !== undefined) values.description = input.description;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await db
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
    const result = await db
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
