import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  pgEnum,
  numeric,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { prospects } from './prospect.schema';
import { users } from './user.schema';

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'generated',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
]);

export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    prospectId: uuid('prospect_id')
      .notNull()
      .references(() => prospects.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    title: varchar('title', {
      length: 255,
    }).notNull(),

    description: text('description'),

    requirements: text('requirements'),

    status: proposalStatusEnum('status').default('draft').notNull(),

    price: numeric('price', {
      precision: 12,
      scale: 2,
    }),

    currency: varchar('currency', {
      length: 3,
    })
      .default('USD')
      .notNull(),

    validUntil: timestamp('valid_until', {
      withTimezone: true,
    }),

    content: text('content'),

    sentAt: timestamp('sent_at', {
      withTimezone: true,
    }),

    viewedAt: timestamp('viewed_at', {
      withTimezone: true,
    }),

    acceptedAt: timestamp('accepted_at', {
      withTimezone: true,
    }),

    rejectedAt: timestamp('rejected_at', {
      withTimezone: true,
    }),

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
  (table) => ({
    tenantIdIdx: index('proposals_tenant_id_idx').on(table.tenantId),
    prospectIdIdx: index('proposals_prospect_id_idx').on(table.prospectId),
    statusIdx: index('proposals_status_idx').on(table.status),
    tenantStatusIdx: index('proposals_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);
