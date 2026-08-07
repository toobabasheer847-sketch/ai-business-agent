import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  vector,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

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

    // S3 object URL/key
    source: varchar('source', {
      length: 2048,
    }),

    // Example: pdf, docx, txt, website, etc.
    sourceType: varchar('source_type', {
      length: 100,
    }),

    // Example: application/pdf, text/plain, etc.
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

    /**
     * Vector embedding generated from chunk content.
     *
     * Model:
     * gemini-embedding-001
     *
     * Dimensions:
     * 3072
     */
    embedding: vector('embedding', {
      dimensions: 3072,
    }),

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

    index('knowledge_chunks_source_type_idx').on(table.sourceType),

    index('knowledge_chunks_doc_type_idx').on(table.docType),

    index('knowledge_chunks_category_idx').on(table.category),

    /**
     * HNSW index for fast cosine similarity search.
     */
    index('knowledge_chunks_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);