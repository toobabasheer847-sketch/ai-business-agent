import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const twilioPhoneNumbers = pgTable(
  'twilio_phone_numbers',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    phoneNumber: varchar('phone_number', { length: 50 }).notNull(),

    phoneNumberSid: varchar('phone_number_sid', { length: 255 }),

    friendlyName: varchar('friendly_name', { length: 255 }),

    accountSid: varchar('account_sid', { length: 255 }),

    authToken: text('auth_token'),

    appSid: varchar('app_sid', { length: 255 }),

    appName: varchar('app_name', { length: 255 }),

    webhookUrl: text('webhook_url'),

    status: varchar('status', { length: 50 })
      .notNull()
      .default('active'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('twilio_phone_numbers_tenant_phone_unique').on(
      table.tenantId,
      table.phoneNumber,
    ),
    index('twilio_phone_numbers_tenant_id_idx').on(table.tenantId),
    index('twilio_phone_numbers_user_id_idx').on(table.userId),
  ],
);
