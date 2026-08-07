import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  vector,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { knowledgebases } from './knowledgebase.schema';
import { knowledgeDocuments } from './knowledge-document.schema';

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
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

    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    content: text('content').notNull(),

    chunkIndex: integer('chunk_index')
      .notNull(),

    /**
     * Vector embedding generated from the chunk content.
     *
     * Model:
     * gemini-embedding-001
     *
     * Dimensions:
     * 3072
     *
     * Nullable because a chunk can exist before
     * the asynchronous embedding process completes.
     */
    embedding: vector('embedding', {
      dimensions: 3072,
    }),

    /**
     * Store the embedding model used for this chunk.
     * This becomes important if the embedding model
     * is changed in the future and existing vectors
     * need to be re-generated.
     */
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
    index(
      'knowledge_chunks_tenant_id_idx',
    ).on(table.tenantId),

    index(
      'knowledge_chunks_knowledge_base_id_idx',
    ).on(table.knowledgeBaseId),

    index(
      'knowledge_chunks_document_id_idx',
    ).on(table.documentId),

    index(
      'knowledge_chunks_tenant_knowledge_base_idx',
    ).on(
      table.tenantId,
      table.knowledgeBaseId,
    ),

    uniqueIndex(
      'knowledge_chunks_document_chunk_index_unique',
    ).on(
      table.documentId,
      table.chunkIndex,
    ),

    /**
     * HNSW index for fast cosine similarity search.
     */
    index(
      'knowledge_chunks_embedding_hnsw_idx',
    ).using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);