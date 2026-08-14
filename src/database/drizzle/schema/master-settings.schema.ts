import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

/**
 * Fixed per-tenant defaults (existing table — kept as-is structurally).
 */
export const masterSettings = pgTable('master_settings', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  defaultLanguage: varchar('default_language', { length: 10 })
    .notNull()
    .default('en'),

  defaultTimezone: varchar('default_timezone', { length: 100 })
    .notNull()
    .default('UTC'),

  defaultCurrency: varchar('default_currency', { length: 3 })
    .notNull()
    .default('USD'),

  aiModel: varchar('ai_model', { length: 100 }),

  maxConversationHistory: integer('max_conversation_history')
    .notNull()
    .default(20),

  enableNotifications: boolean('enable_notifications')
    .notNull()
    .default(true),

  notificationEmail: varchar('notification_email', { length: 255 }),

  businessHoursStart: integer('business_hours_start').notNull().default(9),

  businessHoursEnd: integer('business_hours_end').notNull().default(18),

  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 *  Master setting: key / value / type-role (e.g. profile, stripe/cc).
 * Separate from fixed master_settings so existing rows stay untouched.
 */
export const masterSettingEntries = pgTable(
  'master_setting_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    key: varchar('key', { length: 255 }).notNull(),

    value: text('value'),

    /** Notebook: type/role — e.g. profile, stripe, cc */
    typeRole: varchar('type_role', { length: 100 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('master_setting_entries_tenant_key_unique').on(
      table.tenantId,
      table.key,
    ),
  ],
);
