import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const gmailConfigs = pgTable('gmail_configs', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  email: varchar('email', {
    length: 255,
  }).notNull(),

  clientId: text('client_id'),

  clientSecret: text('client_secret'),

  accessToken: text('access_token'),

  refreshToken: text('refresh_token'),

  tokenExpiry: timestamp('token_expiry', {
    withTimezone: true,
  }),

  isActive: boolean('is_active').notNull().default(true),

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
