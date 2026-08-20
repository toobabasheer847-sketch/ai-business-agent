import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  knowledgeChunks,
  knowledgeDocuments,
} from '../../database/drizzle/schema';
import type { KnowledgeDocumentStatus } from './knowledge-document.constants';

const DOCUMENT_COLUMNS = {
  id: knowledgeDocuments.id,
  tenantId: knowledgeDocuments.tenantId,
  knowledgeBaseId: knowledgeDocuments.knowledgeBaseId,
  title: knowledgeDocuments.title,
  originalFilename: knowledgeDocuments.originalFilename,
  source: knowledgeDocuments.source,
  mimeType: knowledgeDocuments.mimeType,
  byteSize: knowledgeDocuments.byteSize,
  status: knowledgeDocuments.status,
  failureReason: knowledgeDocuments.failureReason,
  createdAt: knowledgeDocuments.createdAt,
  updatedAt: knowledgeDocuments.updatedAt,
} as const;

@Injectable()
export class KnowledgeDocumentRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async create(input: {
    id: string;
    tenantId: string;
    knowledgeBaseId: string;
    title: string;
    originalFilename: string;
    source?: string | null;
    mimeType?: string | null;
    byteSize?: number | null;
    status: KnowledgeDocumentStatus;
  }) {
    const [row] = await this.db
      .insert(knowledgeDocuments)
      .values({
        id: input.id,
        tenantId: input.tenantId,
        knowledgeBaseId: input.knowledgeBaseId,
        title: input.title,
        originalFilename: input.originalFilename,
        source: input.source ?? null,
        mimeType: input.mimeType ?? null,
        byteSize: input.byteSize ?? null,
        status: input.status,
      })
      .returning(DOCUMENT_COLUMNS);

    return row;
  }

  async findAllByKnowledgeBase(tenantId: string, knowledgeBaseId: string) {
    return this.db
      .select(DOCUMENT_COLUMNS)
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.tenantId, tenantId),
          eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId),
        ),
      )
      .orderBy(desc(knowledgeDocuments.createdAt));
  }

  async findByIdAndTenant(
    id: string,
    tenantId: string,
    knowledgeBaseId?: string,
  ) {
    const filters = [
      eq(knowledgeDocuments.id, id),
      eq(knowledgeDocuments.tenantId, tenantId),
    ];

    if (knowledgeBaseId) {
      filters.push(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId));
    }

    return this.db.query.knowledgeDocuments.findFirst({
      where: and(...filters),
      columns: {
        id: true,
        tenantId: true,
        knowledgeBaseId: true,
        title: true,
        originalFilename: true,
        content: true,
        source: true,
        mimeType: true,
        byteSize: true,
        status: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(
    id: string,
    tenantId: string,
    input: {
      status: KnowledgeDocumentStatus;
      failureReason?: string | null;
      source?: string | null;
    },
  ) {
    const [row] = await this.db
      .update(knowledgeDocuments)
      .set({
        status: input.status,
        failureReason:
          input.failureReason === undefined ? undefined : input.failureReason,
        source: input.source === undefined ? undefined : input.source,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.tenantId, tenantId),
        ),
      )
      .returning(DOCUMENT_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string, knowledgeBaseId: string) {
    const result = await this.db
      .delete(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.tenantId, tenantId),
          eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  async deleteChunksForDocument(tenantId: string, documentId: string) {
    await this.db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.tenantId, tenantId),
          eq(knowledgeChunks.documentId, documentId),
        ),
      );
  }

  async insertChunks(
    rows: Array<{
      tenantId: string;
      knowledgeBaseId: string;
      documentId: string;
      source?: string | null;
      sourceType?: string | null;
      docType?: string | null;
      content: string;
      chunkIndex: string;
      embedding: number[];
      embeddingModel: string;
    }>,
  ) {
    if (rows.length === 0) {
      return;
    }

    await this.db.insert(knowledgeChunks).values(rows);
  }
}
