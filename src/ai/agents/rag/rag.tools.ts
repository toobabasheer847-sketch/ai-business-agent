import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { eq, sql } from 'drizzle-orm';

import { db } from '../../../database/drizzle';
import { knowledgeChunks, knowledgeDocuments } from '../../../database/drizzle/schema';
import { RetrievedChunk } from './types/rag.types';

@Injectable()
export class RagTools {
  private readonly embeddingModel = 'gemini-embedding-001';

  constructor(private readonly configService: ConfigService) {}

  async embedText(text: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    if (!apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY is not configured');
    }

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.embedContent({
      model: this.embeddingModel,
      contents: text,
      config: {
        outputDimensionality: 3072,
      },
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding || embedding.length !== 3072) {
      throw new Error('Embedding generation failed or returned an unexpected size');
    }

    return embedding;
  }

  async searchKnowledge(tenantId: string, query: string, knowledgeBaseId?: string, topK = 5): Promise<RetrievedChunk[]> {
    try {
      const embedding = await this.embedText(query);

      const embeddingSql = sql`'${JSON.stringify(embedding)}'::vector`;

      const whereClauses = [eq(knowledgeChunks.tenantId, tenantId)];

      if (knowledgeBaseId) {
        whereClauses.push(eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId));
      }

      const rows = await db.execute(sql`
        SELECT
          kc.id,
          kc.content,
          kc.chunk_index as "chunkIndex",
          kc.knowledge_base_id as "knowledgeBaseId",
          kc.tenant_id as "tenantId",
          kc.document_id as "documentId",
          kd.title as "documentTitle",
          kd.source as "documentSource",
          1 - (kc.embedding <=> ${embeddingSql}) as similarity
        FROM ${knowledgeChunks} kc
        LEFT JOIN ${knowledgeDocuments} kd ON kd.id = kc.document_id
        WHERE ${sql.join(whereClauses, sql` AND `)}
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> ${embeddingSql}
        LIMIT ${topK}
      ` as any);

      return rows.rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        similarity: Number(row.similarity),
        documentId: row.documentId,
        knowledgeBaseId: row.knowledgeBaseId,
        tenantId: row.tenantId,
        chunkIndex: Number(row.chunkIndex),
        documentTitle: row.documentTitle,
        documentSource: row.documentSource,
      }));
    } catch (error) {
      return [];
    }
  }
}
