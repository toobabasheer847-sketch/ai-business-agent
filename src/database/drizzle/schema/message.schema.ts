import {
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

export const messages = pgTable('messages', {
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