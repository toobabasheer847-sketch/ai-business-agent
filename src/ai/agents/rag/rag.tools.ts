import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { eq, sql } from 'drizzle-orm';

import { db } from '../../../database/drizzle';
import { knowledgeChunks } from '../../../database/drizzle/schema';
import { RetrievedChunk } from './types/rag.types';

@Injectable()
export class RagTools {
  private readonly embeddingModel = 'gemini-embedding-001';

  constructor(private readonly configService: ConfigService) {}

  async embedText(text: string): Promise<number[]> {
    const apiKey = this.configService.get<string>(
      'GOOGLE_GENAI_API_KEY',
    );

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
      throw new Error(
        'Embedding generation failed or returned an unexpected size',
      );
    }

    return embedding;
  }

  async searchKnowledge(
    tenantId: string,
    query: string,
    topK = 5,
  ): Promise<RetrievedChunk[]> {
    try {
      const embedding = await this.embedText(query);

      const embeddingSql = sql`${JSON.stringify(embedding)}::vector`;

      const whereClauses = [
        eq(knowledgeChunks.tenantId, tenantId),
      ];

      const rows = await db.execute(sql`
        SELECT
          kc.id,
          kc.content,
          kc.tenant_id AS "tenantId",
          kc.source AS "source",
          kc.source_type AS "sourceType",
          kc.doc_type AS "docType",
          kc.category,
          kc.chunk_index AS "chunkIndex",
          kc.embedding_model AS "embeddingModel",
          kc.created_at AS "createdAt",
          1 - (kc.embedding <=> ${embeddingSql}) AS similarity
        FROM ${knowledgeChunks} kc
        WHERE ${sql.join(whereClauses, sql` AND `)}
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> ${embeddingSql}
        LIMIT ${topK}
      `);

      return rows.rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        tenantId: row.tenantId,
        source: row.source,
        sourceType: row.sourceType,
        docType: row.docType,
        category: row.category,
        chunkIndex: row.chunkIndex,
        embeddingModel: row.embeddingModel,
        createdAt: row.createdAt,
        similarity: Number(row.similarity),
      }));
    } catch (error) {
      console.error('RAG knowledge search failed:', error);
      return [];
    }
  }
}