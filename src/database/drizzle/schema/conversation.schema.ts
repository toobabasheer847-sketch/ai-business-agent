import {
  index,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { companies } from './company.schema';
import { leads } from './lead.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { prospects } from './prospect.schema';

export const conversations = pgTable(
  'conversations',
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

    prospectId: uuid('prospect_id').references(() => prospects.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    leadId: uuid('lead_id').references(() => leads.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    assignedUserId: uuid('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    externalAddress: varchar('external_address', { length: 255 }),

    title: varchar('title', {
      length: 255,
    }),

    slug: varchar('slug', {
      length: 255,
    }).notNull(),

    description: text('description'),

    channel: varchar('channel', {
      length: 50,
    })
      .notNull()
      .default('web'),

    status: varchar('status', {
      length: 50,
    })
      .notNull()
      .default('active'),

    summary: text('summary'),

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
  },
  (table) => [
    index('conversations_tenant_user_updated_idx').on(
      table.tenantId,
      table.userId,
      table.updatedAt,
    ),
    index('conversations_tenant_channel_address_idx').on(
      table.tenantId,
      table.channel,
      table.externalAddress,
    ),
    index('conversations_tenant_lead_idx').on(table.tenantId, table.leadId),
    index('conversations_tenant_assigned_idx').on(table.tenantId, table.assignedUserId),
  ],
);