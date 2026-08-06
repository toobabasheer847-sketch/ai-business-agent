import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { knowledgebases } from './knowledgebase.schema';

export const knowledgeDocuments = pgTable(
  'knowledge_documents',
  {
    id: uuid('id')
      .defaultRandom()
      .primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgebases.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    title: varchar('title', {
      length: 500,
    }).notNull(),

    content: text('content'),

    source: varchar('source', {
      length: 2048,
    }),

    mimeType: varchar('mime_type', {
      length: 100,
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
    tenantIdIdx: index(
      'knowledge_documents_tenant_id_idx',
    ).on(table.tenantId),

    knowledgeBaseIdIdx: index(
      'knowledge_documents_knowledge_base_id_idx',
    ).on(table.knowledgeBaseId),

    tenantKnowledgeBaseIdx: index(
      'knowledge_documents_tenant_knowledge_base_idx',
    ).on(
      table.tenantId,
      table.knowledgeBaseId,
    ),
  }),
);