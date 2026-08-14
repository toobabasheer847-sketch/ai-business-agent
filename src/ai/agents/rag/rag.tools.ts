import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { eq, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.service';
import { knowledgeChunks } from '../../../database/drizzle/schema';
import { RetrievedChunk } from './types/rag.types';

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return Number.NaN;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return Number.NaN;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

@Injectable()
export class RagTools {
  private readonly embeddingModel = 'gemini-embedding-001';

  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

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

      // Local DB stores embeddings as float8[] (no pgvector required).
      const rows = await this.db.execute(sql`
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
          kc.embedding AS embedding
        FROM ${knowledgeChunks} kc
        WHERE ${eq(knowledgeChunks.tenantId, tenantId)}
          AND kc.embedding IS NOT NULL
      `);

      const scored = (rows.rows as any[])
        .map((row) => {
          const values = Array.isArray(row.embedding)
            ? row.embedding.map((n: unknown) => Number(n))
            : [];
          return {
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
            similarity: cosineSimilarity(embedding, values),
          };
        })
        .filter((row) => Number.isFinite(row.similarity))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return scored;
    } catch (error) {
      console.error('RAG knowledge search failed:', error);
      return [];
    }
  }
}