import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
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

  // Gmail account email address
  email: varchar('email', {
    length: 255,
  }).notNull(),

  // OAuth configuration
  clientId: text('client_id'),

  clientSecret: text('client_secret'),

  accessToken: text('access_token'),

  refreshToken: text('refresh_token'),

  tokenExpiry: timestamp('token_expiry', {
    withTimezone: true,
  }),

  // SMTP configuration
  smtpHost: varchar('smtp_host', {
    length: 255,
  })
    .notNull()
    .default('smtp.gmail.com'),

  smtpPort: integer('smtp_port')
    .notNull()
    .default(587),

  smtpUsername: varchar('smtp_username', {
    length: 255,
  }),

  smtpPassword: text('smtp_password'),

  fromName: varchar('from_name', {
    length: 255,
  }),

  isActive: boolean('is_active')
    .notNull()
    .default(true),

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