import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.service';
import { knowledgeChunks } from '../../../database/drizzle/schema';
import { RetrievedChunk } from './types/rag.types';

const EMBEDDING_DIMENSIONS = 3072;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) {
    return Number.NaN;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (!Number.isFinite(av) || !Number.isFinite(bv)) {
      return Number.NaN;
    }
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return Number.NaN;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function toFloat8ArrayLiteral(values: number[]): string {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Embedding array is empty');
  }

  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Embedding array contains a non-finite number');
    }
  }

  return `{${values.join(',')}}`;
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
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
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
    knowledgeBaseId?: string,
  ): Promise<RetrievedChunk[]> {
    try {
      const embedding = await this.embedText(query);
      const queryEmbeddingSql = sql`${toFloat8ArrayLiteral(embedding)}::float8[]`;
      const limit = Math.max(1, Math.min(Math.trunc(topK) || 5, 50));

      const whereClauses = [
        sql`kc.tenant_id = ${tenantId}`,
        sql`kc.embedding is not null`,
        sql`cardinality(kc.embedding) = ${embedding.length}`,
      ];

      if (knowledgeBaseId) {
        whereClauses.push(sql`kc.knowledge_base_id = ${knowledgeBaseId}`);
      }

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
          (
            SELECT COALESCE(SUM(a * b), 0)
            FROM unnest(kc.embedding, ${queryEmbeddingSql}) AS t(a, b)
          ) / NULLIF(
            sqrt((SELECT COALESCE(SUM(x * x), 0) FROM unnest(kc.embedding) AS u(x)))
            * sqrt((SELECT COALESCE(SUM(x * x), 0) FROM unnest(${queryEmbeddingSql}) AS u(x))),
            0
          ) AS similarity
        FROM ${knowledgeChunks} kc
        WHERE ${sql.join(whereClauses, sql` AND `)}
        ORDER BY similarity DESC NULLS LAST
        LIMIT ${limit}
      `);

      return rows.rows
        .map((row: any) => ({
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
        }))
        .filter((row) => Number.isFinite(row.similarity));
    } catch (error) {
      console.error('RAG knowledge search failed:', error);
      return [];
    }
  }
}
