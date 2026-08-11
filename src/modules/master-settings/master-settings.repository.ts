import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { masterSettings } from '../../database/drizzle/schema';

const RETURNING_COLUMNS = {
  id: masterSettings.id,
  tenantId: masterSettings.tenantId,
  defaultLanguage: masterSettings.defaultLanguage,
  defaultTimezone: masterSettings.defaultTimezone,
  defaultCurrency: masterSettings.defaultCurrency,
  aiModel: masterSettings.aiModel,
  maxConversationHistory: masterSettings.maxConversationHistory,
  enableNotifications: masterSettings.enableNotifications,
  notificationEmail: masterSettings.notificationEmail,
  businessHoursStart: masterSettings.businessHoursStart,
  businessHoursEnd: masterSettings.businessHoursEnd,
  isActive: masterSettings.isActive,
  createdAt: masterSettings.createdAt,
  updatedAt: masterSettings.updatedAt,
} as const;

@Injectable()
export class MasterSettingsRepository {
  async findByTenantId(tenantId: string) {
    return db.query.masterSettings.findFirst({
      where: eq(masterSettings.tenantId, tenantId),
      columns: {
        id: true,
        tenantId: true,
        defaultLanguage: true,
        defaultTimezone: true,
        defaultCurrency: true,
        aiModel: true,
        maxConversationHistory: true,
        enableNotifications: true,
        notificationEmail: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(tenantId: string) {
    const [row] = await db
      .insert(masterSettings)
      .values({ tenantId })
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    tenantId: string,
    input: {
      defaultLanguage?: string;
      defaultTimezone?: string;
      defaultCurrency?: string;
      aiModel?: string | null;
      maxConversationHistory?: number;
      enableNotifications?: boolean;
      notificationEmail?: string | null;
      businessHoursStart?: number;
      businessHoursEnd?: number;
      isActive?: boolean;
    },
  ) {
    const values: Partial<typeof masterSettings.$inferInsert> = {};

    if (input.defaultLanguage !== undefined) values.defaultLanguage = input.defaultLanguage;
    if (input.defaultTimezone !== undefined) values.defaultTimezone = input.defaultTimezone;
    if (input.defaultCurrency !== undefined) values.defaultCurrency = input.defaultCurrency;
    if (input.aiModel !== undefined) values.aiModel = input.aiModel;
    if (input.maxConversationHistory !== undefined) values.maxConversationHistory = input.maxConversationHistory;
    if (input.enableNotifications !== undefined) values.enableNotifications = input.enableNotifications;
    if (input.notificationEmail !== undefined) values.notificationEmail = input.notificationEmail;
    if (input.businessHoursStart !== undefined) values.businessHoursStart = input.businessHoursStart;
    if (input.businessHoursEnd !== undefined) values.businessHoursEnd = input.businessHoursEnd;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    if (Object.keys(values).length === 0) {
      return this.findByTenantId(tenantId);
    }

    const [row] = await db
      .update(masterSettings)
      .set(values)
      .where(eq(masterSettings.tenantId, tenantId))
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }
}
