import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { twilioApps } from '../../database/drizzle/schema/twilio-app.schema';
import type { TenantTwilioAppConfig } from './twilio-app-configuration';

/**
 * Repository for reading Twilio app credentials from the twilio_apps table.
 * All queries are scoped to tenantId to enforce multi-tenant isolation.
 */
@Injectable()
export class TwilioAppRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  /**
   * Returns the first active Twilio app configuration for the given tenant.
   * Returns null when no record exists or the tenant has no active app.
   */
  async findActiveForTenant(tenantId: string): Promise<TenantTwilioAppConfig | null> {
    if (!tenantId) return null;

    const result = await this.db
      .select({
        id: twilioApps.id,
        tenantId: twilioApps.tenantId,
        phoneNumberId: twilioApps.phoneNumberId,
        accountSid: twilioApps.accountSid,
        authToken: twilioApps.authToken,
        appSid: twilioApps.appSid,
        webhookUrl: twilioApps.webhookUrl,
        status: twilioApps.status,
      })
      .from(twilioApps)
      .where(
        and(
          eq(twilioApps.tenantId, tenantId),
          eq(twilioApps.status, 'active'),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Returns a specific Twilio app configuration by its ID, ensuring it belongs
   * to the requested tenant (tenant-scoped lookup).
   */
  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<TenantTwilioAppConfig | null> {
    if (!id || !tenantId) return null;

    const result = await this.db
      .select({
        id: twilioApps.id,
        tenantId: twilioApps.tenantId,
        phoneNumberId: twilioApps.phoneNumberId,
        accountSid: twilioApps.accountSid,
        authToken: twilioApps.authToken,
        appSid: twilioApps.appSid,
        webhookUrl: twilioApps.webhookUrl,
        status: twilioApps.status,
      })
      .from(twilioApps)
      .where(
        and(
          eq(twilioApps.id, id),
          eq(twilioApps.tenantId, tenantId),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }
}
