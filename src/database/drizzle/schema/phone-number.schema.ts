import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

/**
 * Single phone/Twilio table ( phone-numbers or twilio).
 * Holds the number plus Twilio SID/credentials/webhook on the same row.
 */
export const phoneNumbers = pgTable(
  'phone_numbers',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    /** Optional owner user (notebook: user-id). */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    phoneNumber: varchar('phone_number', { length: 50 }).notNull(),

    label: varchar('label', { length: 255 }),

    provider: varchar('provider', { length: 100 }).notNull().default('twilio'),

    status: varchar('status', { length: 50 }).notNull().default('active'),

    description: text('description'),

    /** Twilio IncomingPhoneNumber SID (notebook: phone sid). */
    phoneSid: varchar('phone_sid', { length: 255 }),

    /** Twilio Account SID (notebook: twilio sid). */
    twilioSid: varchar('twilio_sid', { length: 255 }),

    /** Twilio Auth Token (kept on same row after merging twilio_apps). */
    authToken: text('auth_token'),

    /** Twilio TwiML / API App SID. */
    appSid: varchar('app_sid', { length: 255 }),

    /** Notebook: msg — free-form note / messaging metadata. */
    msg: text('msg'),

    /** Notebook: webhook url. */
    webhookUrl: text('webhook_url'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('phone_numbers_tenant_phone_unique').on(
      table.tenantId,
      table.phoneNumber,
    ),
    index('phone_numbers_tenant_id_idx').on(table.tenantId),
    index('phone_numbers_user_id_idx').on(table.userId),
    index('phone_numbers_phone_sid_idx').on(table.phoneSid),
  ],
);
