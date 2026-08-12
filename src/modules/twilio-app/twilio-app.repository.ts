import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { phoneNumbers, twilioApps } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: twilioApps.id,
  tenantId: twilioApps.tenantId,
  phoneNumberId: twilioApps.phoneNumberId,
  accountSid: twilioApps.accountSid,
  authToken: twilioApps.authToken,
  appSid: twilioApps.appSid,
  webhookUrl: twilioApps.webhookUrl,
  status: twilioApps.status,
  createdAt: twilioApps.createdAt,
  updatedAt: twilioApps.updatedAt,
} as const;

export interface ListTwilioAppsOptions {
  phoneNumberId?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class TwilioAppRepository {
  /**
   * Verify a phone number belongs to the tenant before creating/relating a Twilio App.
   */
  async findPhoneNumberByIdAndTenant(phoneNumberId: string, tenantId: string) {
    return db.query.phoneNumbers.findFirst({
      where: and(
        eq(phoneNumbers.id, phoneNumberId),
        eq(phoneNumbers.tenantId, tenantId),
      ),
      columns: { id: true },
    });
  }

  async findAllByTenant(tenantId: string, options: ListTwilioAppsOptions = {}) {
    const { phoneNumberId, status, search } = options;

    const conditions = [eq(twilioApps.tenantId, tenantId)];

    if (phoneNumberId) {
      conditions.push(eq(twilioApps.phoneNumberId, phoneNumberId));
    }

    if (status) {
      conditions.push(eq(twilioApps.status, status));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(twilioApps.accountSid, `%${search.trim()}%`),
          ilike(twilioApps.appSid, `%${search.trim()}%`),
          ilike(twilioApps.webhookUrl, `%${search.trim()}%`),
        )!,
      );
    }

    return db
      .select(RETURNING_COLUMNS)
      .from(twilioApps)
      .where(and(...conditions))
      .orderBy(desc(twilioApps.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.twilioApps.findFirst({
      where: and(
        eq(twilioApps.id, id),
        eq(twilioApps.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        phoneNumberId: true,
        accountSid: true,
        authToken: true,
        appSid: true,
        webhookUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    phoneNumberId: string;
    accountSid: string;
    authToken: string;
    appSid?: string;
    webhookUrl?: string;
    status?: string;
  }) {
    const [row] = await db
      .insert(twilioApps)
      .values({
        tenantId: input.tenantId,
        phoneNumberId: input.phoneNumberId,
        accountSid: input.accountSid,
        authToken: input.authToken,
        appSid: input.appSid ?? null,
        webhookUrl: input.webhookUrl ?? null,
        status: input.status ?? 'active',
      })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      phoneNumberId?: string;
      accountSid?: string;
      authToken?: string;
      appSid?: string | null;
      webhookUrl?: string | null;
      status?: string;
    },
  ) {
    const values: Partial<typeof twilioApps.$inferInsert> = {};

    if (input.phoneNumberId !== undefined) values.phoneNumberId = input.phoneNumberId;
    if (input.accountSid !== undefined) values.accountSid = input.accountSid;
    if (input.authToken !== undefined) values.authToken = input.authToken;
    if (input.appSid !== undefined) values.appSid = input.appSid;
    if (input.webhookUrl !== undefined) values.webhookUrl = input.webhookUrl;
    if (input.status !== undefined) values.status = input.status;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await db
      .update(twilioApps)
      .set(values)
      .where(
        and(
          eq(twilioApps.id, id),
          eq(twilioApps.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(twilioApps)
      .where(
        and(
          eq(twilioApps.id, id),
          eq(twilioApps.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
