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

/**
 * Live database table: public.phone_numbers
 *
 * Historical export name `twilioPhoneNumbers` is kept as an alias in
 * twilio-phone-number.schema.ts for existing imports/relations.
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

    phoneNumber: varchar('phone_number', { length: 50 }).notNull(),

    label: varchar('label', { length: 255 }),

    provider: varchar('provider', { length: 100 }).notNull().default('twilio'),

    status: varchar('status', { length: 50 }).notNull().default('active'),

    description: text('description'),

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
  ],
);
