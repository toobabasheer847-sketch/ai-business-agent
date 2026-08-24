import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gemini, FunctionTool, LlmAgent } from '@google/adk';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { runAdkEphemeral } from '../../adk/run-adk-ephemeral.js';
import { getTrustedAiContext, runWithAiContext } from '../../context/ai-request-context.js';
import {
  consumeRagSearchChunks,
  recordRagSearchChunks,
  runWithRagDelegationState,
} from '../../context/rag-delegation-context.js';
import { resolveAdkModelName } from '../../context/resolve-adk-model.js';
import { RagTools } from './rag.tools';
import {
  RagQueryOptions,
  RagResponse,
  RagSourceMetadata,
  RetrievedChunk,
} from './types/rag.types';

const NO_KNOWLEDGE_ANSWER =
  "I couldn't find enough relevant information in the knowledge base to answer that question.";

const RAG_UNAVAILABLE_ANSWER =
  'Knowledge search is unavailable because the AI provider is not configured.';

const DEFAULT_ANSWER_MIN_SIMILARITY = 0.4;

@Injectable()
export class RagAgent {
  private readonly logger = new Logger(RagAgent.name);
  private readonly agent: LlmAgent | null;
  private readonly modelName: string;
  private readonly apiKey: string | null;

  constructor(
    private readonly ragTools: RagTools,
    private readonly configService: ConfigService,
  ) {
    this.modelName = resolveAdkModelName(this.configService);
    const rawKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY')?.trim();
    this.apiKey = rawKey || null;

    if (!this.apiKey) {
      this.logger.warn(
        'RAG agent starting without GOOGLE_GENAI_API_KEY — RAG routes are disabled; other features continue.',
      );
      this.agent = null;
      return;
    }

    this.agent = this.buildLlmAgent(this.modelName);
  }

  /** True when Gemini credentials are available for RAG. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  buildLlmAgent(modelName: string): LlmAgent {
    if (!this.apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY is not configured');
    }

    const geminiModel = new Gemini({
      model: modelName,
      apiKey: this.apiKey,
    });

    const searchKnowledgeTool = new FunctionTool({
      name: 'search_knowledge',
      description:
        'Search tenant-scoped knowledge chunks using semantic similarity.',
      parameters: z.object({
        query: z.string(),
        topK: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const { tenantId } = getTrustedAiContext();

        const chunks = await this.ragTools.searchKnowledge(
          tenantId,
          input.query,
          input.topK ?? 5,
        );
        recordRagSearchChunks(chunks);

        return {
          chunks,
        };
      },
    });

    return new LlmAgent({
      name: 'rag_agent',
      model: geminiModel,
      instruction: `You are a tenant-aware RAG assistant. Use the provided knowledge tool to search tenant-specific knowledge before answering. Do not hallucinate company facts. If the available knowledge is insufficient, say so clearly and avoid inventing details. Include source information when available.`,
      tools: [searchKnowledgeTool],
    });
  }

  getAgentInstance() {
    return this.agent;
  }

  private unavailableResponse(): RagResponse {
    return {
      answer: RAG_UNAVAILABLE_ANSWER,
      sources: [],
      usedKnowledge: false,
      message: 'GOOGLE_GENAI_API_KEY is not configured',
    };
  }

  /**
   * Deterministic retrieval + grounded generation fallback.
   */
  async delegateQuery(
    tenantId: string,
    userId: string,
    query: string,
    options: RagQueryOptions = {},
  ): Promise<RagResponse> {
    return runWithAiContext({ tenantId, userId }, () =>
      this.answerQuery(tenantId, query, options),
    );
  }

  /**
   * ADK tool-calling loop with deterministic fallback when the model path fails.
   */
  async delegateAdkQuery(
    tenantId: string,
    userId: string,
    query: string,
    agent: LlmAgent,
    options: RagQueryOptions = {},
  ): Promise<RagResponse> {
    return runWithAiContext({ tenantId, userId }, () =>
      runWithRagDelegationState(async () => {
        try {
          const adkResult = await runAdkEphemeral({
            appName: 'rag-agent',
            agent,
            userId,
            message: query,
          });

          const answer = adkResult.finalText.trim();
          const chunks = consumeRagSearchChunks();
          const relevantChunks = this.filterRelevantChunks(chunks);

          if (answer && relevantChunks.length) {
            if (this.indicatesNoKnowledge(answer)) {
              return {
                answer: NO_KNOWLEDGE_ANSWER,
                sources: [],
                usedKnowledge: false,
                message: 'No relevant chunks were found.',
              };
            }

            return {
              answer,
              sources: this.mapSources(relevantChunks),
              usedKnowledge: true,
            };
          }
        } catch {
          // Fall back to deterministic grounded answer path.
        }

        return this.answerQuery(tenantId, query, options);
      }),
    );
  }

  async answerQuery(
    tenantId: string,
    query: string,
    options: RagQueryOptions = {},
  ): Promise<RagResponse> {
    if (!this.apiKey) {
      return this.unavailableResponse();
    }

    const topK = options.topK ?? 5;
    const chunks = await this.ragTools.searchKnowledge(
      tenantId,
      query,
      topK,
      options.knowledgeBaseId,
    );

    const relevantChunks = this.filterRelevantChunks(chunks);

    if (!relevantChunks.length) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        usedKnowledge: false,
        message: 'No relevant chunks were found.',
      };
    }

    const context = relevantChunks
      .map(
        (chunk: RetrievedChunk) =>
          `Document: ${chunk.documentName ?? chunk.source ?? 'Unknown'}\nSource type: ${chunk.sourceType ?? chunk.docType ?? 'Unknown'}\nChunk ${chunk.chunkIndex ?? 'N/A'}: ${chunk.content}`,
      )
      .join('\n\n');

    const prompt = `Answer the user's question using only the following knowledge context. If the context does not contain enough information, say clearly that you could not find enough relevant information in the knowledge base and do not invent details.\n\nContext:\n${context}\n\nQuestion: ${query}`;

    let finalText = '';
    let modelError: string | undefined;

    try {
      finalText = await this.generateGroundedAnswer(prompt);
    } catch (error) {
      modelError = error instanceof Error ? error.message : 'Unknown model error';
      finalText = '';
    }

    if (!finalText.trim()) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        usedKnowledge: false,
        message:
          modelError ??
          'The model did not produce a grounded answer from the retrieved context.',
      };
    }

    const sources = this.mapSources(relevantChunks);

    if (this.indicatesNoKnowledge(finalText)) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        usedKnowledge: false,
        message: 'No relevant chunks were found.',
      };
    }

    return {
      answer: finalText,
      sources,
      usedKnowledge: true,
      message: modelError ? `Model generation failed: ${modelError}` : undefined,
    };
  }

  private filterRelevantChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const answerMinSimilarity = this.getAnswerMinSimilarity();
    return chunks.filter(
      (chunk) =>
        Number.isFinite(chunk.similarity) &&
        chunk.similarity >= answerMinSimilarity,
    );
  }

  private async generateGroundedAnswer(prompt: string): Promise<string> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY is not configured');
    }

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: this.modelName,
      contents: prompt,
    });

    return response.text?.trim() ?? '';
  }

  private indicatesNoKnowledge(answer: string): boolean {
    const normalized = answer.trim().toLowerCase();

    return (
      normalized.includes("couldn't find enough relevant information") ||
      normalized.includes('could not find enough relevant information') ||
      normalized.includes('does not contain information') ||
      normalized.includes('does not contain enough information') ||
      normalized.includes('no relevant information in the knowledge base')
    );
  }

  private mapSources(chunks: RetrievedChunk[]): RagSourceMetadata[] {
    return chunks.map((chunk) => ({
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      source: chunk.source,
      sourceType: chunk.sourceType ?? chunk.docType,
    }));
  }

  private getAnswerMinSimilarity(): number {
    const configured = Number(
      this.configService.get<string>('RAG_ANSWER_MIN_SIMILARITY'),
    );

    if (Number.isFinite(configured) && configured >= 0 && configured <= 1) {
      return configured;
    }

    return DEFAULT_ANSWER_MIN_SIMILARITY;
  }
}
