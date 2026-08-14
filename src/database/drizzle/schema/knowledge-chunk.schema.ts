import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
  doublePrecision,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { knowledgeDocuments } from './knowledge-document.schema';

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
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

    /** Document id */
    documentId: uuid('document_id').references(() => knowledgeDocuments.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

    source: varchar('source', {
      length: 2048,
    }),

    sourceType: varchar('source_type', {
      length: 100,
    }),

    docType: varchar('doc_type', {
      length: 100,
    }),

    category: varchar('category', {
      length: 255,
    }),

    content: text('content').notNull(),

    chunkIndex: varchar('chunk_index', {
      length: 50,
    }),

    metadata: jsonb('metadata'),

    /**
     * : vector embedding.
     * Stored as float8[] so local Postgres works without pgvector.
     */
    embedding: doublePrecision('embedding').array(),

    embeddingModel: varchar('embedding_model', {
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

  (table) => [
    index('knowledge_chunks_tenant_id_idx').on(table.tenantId),
    index('knowledge_chunks_user_id_idx').on(table.userId),
    index('knowledge_chunks_document_id_idx').on(table.documentId),
    index('knowledge_chunks_source_type_idx').on(table.sourceType),
    index('knowledge_chunks_doc_type_idx').on(table.docType),
    index('knowledge_chunks_category_idx').on(table.category),
  ],
);
