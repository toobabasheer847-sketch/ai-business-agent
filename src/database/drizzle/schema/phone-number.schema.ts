import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const phoneNumbers = pgTable('phone_numbers', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  phoneNumber: varchar('phone_number', {
    length: 50,
  }).notNull(),

  label: varchar('label', {
    length: 100,
  }),

  provider: varchar('provider', {
    length: 50,
  })
    .notNull()
    .default('twilio'),

  status: varchar('status', {
    length: 50,
  })
    .notNull()
    .default('active'),

  description: text('description'),

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
