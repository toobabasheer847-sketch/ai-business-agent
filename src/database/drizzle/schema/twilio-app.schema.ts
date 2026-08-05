import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { phoneNumbers } from './phone-number.schema';

export const twilioApps = pgTable('twilio_apps', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  phoneNumberId: uuid('phone_number_id')
    .notNull()
    .references(() => phoneNumbers.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  accountSid: varchar('account_sid', {
    length: 255,
  }).notNull(),

  authToken: text('auth_token').notNull(),

  appSid: varchar('app_sid', {
    length: 255,
  }),

  webhookUrl: text('webhook_url'),

  status: varchar('status', {
    length: 50,
  })
    .notNull()
    .default('active'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});