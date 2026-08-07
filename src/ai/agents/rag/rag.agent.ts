import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gemini, FunctionTool, InMemoryRunner, LlmAgent } from '@google/adk';
import { z } from 'zod';

import { RagTools } from './rag.tools';
import { RagResponse, RetrievedChunk } from './types/rag.types';

@Injectable()
export class RagAgent {
  private readonly agent: LlmAgent;

  constructor(
    private readonly ragTools: RagTools,
    private readonly configService: ConfigService,
  ) {
    const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    if (!apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY is not configured');
    }

    const searchKnowledgeTool = new FunctionTool({
      name: 'search_knowledge',
      description: 'Search tenant-scoped knowledge chunks using semantic similarity.',
      parameters: z.object({
        tenantId: z.string(),
        query: z.string(),
        knowledgeBaseId: z.string().optional(),
        topK: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const chunks = await this.ragTools.searchKnowledge(
          input.tenantId,
          input.query,
          input.knowledgeBaseId,
          input.topK ?? 5,
        );

        return {
          chunks,
        };
      },
    });

    this.agent = new LlmAgent({
      name: 'rag_agent',
      model: new Gemini({
        model: modelName,
        apiKey,
      }),
      instruction: `You are a tenant-aware RAG assistant. Use the provided knowledge tool to search tenant-specific knowledge before answering. Do not hallucinate company facts. If the available knowledge is insufficient, say so clearly and avoid inventing details. Include source information when available.`,
      tools: [searchKnowledgeTool],
    });
  }

  async answerQuery(tenantId: string, query: string, knowledgeBaseId?: string): Promise<RagResponse> {
    const chunks = await this.ragTools.searchKnowledge(tenantId, query, knowledgeBaseId, 5);

    if (!chunks.length) {
      return {
        answer: 'I could not find enough relevant knowledge in the current tenant knowledge base to answer this question.',
        sources: [],
        usedKnowledge: false,
        message: 'No relevant chunks were found.',
      };
    }

    const context = chunks
      .map((chunk: RetrievedChunk) => `Source: ${chunk.documentTitle ?? 'Unknown'}\nChunk ${chunk.chunkIndex}: ${chunk.content}`)
      .join('\n\n');

    const prompt = `Answer the user's question using only the following knowledge context. If the context does not contain enough information, state that clearly.\n\nContext:\n${context}\n\nQuestion: ${query}`;

    const runner = new InMemoryRunner({
      appName: 'rag-agent',
      agent: this.agent,
    });

    let finalText = '';
    let modelError: string | undefined;

    try {
      for await (const event of runner.runEphemeral({
        userId: tenantId,
        newMessage: {
          parts: [{ text: prompt }],
        },
      })) {
        if (event?.content?.parts?.length) {
          const textParts = event.content.parts
            .filter((part: any) => part?.text)
            .map((part: any) => part.text)
            .join('');

          if (textParts) {
            finalText = textParts;
          }
        }
      }
    } catch (error) {
      modelError = error instanceof Error ? error.message : 'Unknown model error';
      finalText = '';
    }

    const fallbackAnswer = `I used the available tenant knowledge to answer this question.\n\nContext summary:\n${chunks
      .slice(0, 3)
      .map((chunk) => `- ${chunk.content}`)
      .join('\n')}`;

    return {
      answer: finalText || fallbackAnswer,
      sources: chunks.map((chunk) => ({
        documentId: chunk.documentId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        documentTitle: chunk.documentTitle,
        documentSource: chunk.documentSource,
      })),
      usedKnowledge: true,
      message: modelError ? `Model generation failed: ${modelError}` : undefined,
    };
  }
}
