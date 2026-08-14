import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
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

    /** S3 object URL/key or external source */
    source: varchar('source', {
      length: 2048,
    }),

    /**  Source type */
    sourceType: varchar('source_type', {
      length: 100,
    }),

    /** : Doc type */
    docType: varchar('doc_type', {
      length: 100,
    }),

    mimeType: varchar('mime_type', {
      length: 100,
    }),

    /**  category */
    category: varchar('category', {
      length: 255,
    }),

    /**  Meta Data */
    metadata: jsonb('metadata'),

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