import {
  index,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { conversations } from './conversation.schema';
import { users } from './user.schema';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    // human or ai
    role: varchar('role', {
      length: 50,
    })
      .notNull()
      .default('human'),

    // Message / AI response text
    content: text('content').notNull(),

    // Additional message information
    metadata: jsonb('metadata'),

    // LLM token usage
    inputTokens: integer('input_tokens'),

    outputTokens: integer('output_tokens'),

    totalTokens: integer('total_tokens'),

    // Media information such as audio/image/file URL
    mediaFile: jsonb('media_file'),

    direction: varchar('direction', { length: 20 }),
    deliveryStatus: varchar('delivery_status', { length: 30 }),
    provider: varchar('provider', { length: 40 }),
    providerMessageId: varchar('provider_message_id', { length: 128 }),
    channel: varchar('channel', { length: 30 }),
    purpose: varchar('purpose', { length: 40 }),
    authorKind: varchar('author_kind', { length: 20 }),
    errorCode: varchar('error_code', { length: 80 }),
    errorDetail: varchar('error_detail', { length: 400 }),

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
    index('messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
    ),
    index('messages_tenant_id_idx').on(table.tenantId),
    index('messages_tenant_provider_message_idx').on(
      table.tenantId,
      table.provider,
      table.providerMessageId,
    ),
  ],
);