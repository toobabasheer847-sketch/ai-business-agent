import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const masterSettings = pgTable('master_settings', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** One settings record per tenant — enforced at the application level. */
  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  /** Default language/locale for the tenant (e.g. 'en', 'en-US'). */
  defaultLanguage: varchar('default_language', { length: 10 })
    .notNull()
    .default('en'),

  /** Default timezone string (IANA format, e.g. 'America/New_York'). */
  defaultTimezone: varchar('default_timezone', { length: 100 })
    .notNull()
    .default('UTC'),

  /** Default currency code (ISO 4217, e.g. 'USD', 'EUR'). */
  defaultCurrency: varchar('default_currency', { length: 3 })
    .notNull()
    .default('USD'),

  /**
   * AI model override for this tenant.
   * If null, the system default from environment variables is used.
   */
  aiModel: varchar('ai_model', { length: 100 }),

  /**
   * Maximum number of conversation history turns to include in AI context.
   * Controls token usage and AI memory window.
   */
  maxConversationHistory: integer('max_conversation_history')
    .notNull()
    .default(20),

  /** Whether email notifications are enabled for this tenant. */
  enableNotifications: boolean('enable_notifications')
    .notNull()
    .default(true),

  /** Email address for receiving tenant-level notifications. */
  notificationEmail: varchar('notification_email', { length: 255 }),

  /**
   * Business hours start (0-23, local time in defaultTimezone).
   * Used for AI agent scheduling and communication preferences.
   */
  businessHoursStart: integer('business_hours_start')
    .notNull()
    .default(9),

  /**
   * Business hours end (0-23, local time in defaultTimezone).
   */
  businessHoursEnd: integer('business_hours_end')
    .notNull()
    .default(18),

  /** Whether master settings (and by extension the tenant) are active. */
  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
