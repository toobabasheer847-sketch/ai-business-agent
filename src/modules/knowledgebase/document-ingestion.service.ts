import { readFile } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';

import { RagTools } from '../../ai/agents/rag/rag.tools';
import { DocumentChunkerService } from './document-chunker.service';
import {
  DocumentParserService,
  NonRetryableIngestionError,
} from './document-parser.service';
import {
  KNOWLEDGE_DOCUMENT_STATUS,
  KNOWLEDGE_EMBEDDING_MODEL,
} from './knowledge-document.constants';
import { KnowledgeDocumentRepository } from './knowledge-document.repository';
import { KnowledgeFileStorage } from './knowledge-file.storage';
import {
  detectKnowledgeSourceType,
  toSafeFailureReason,
} from './knowledge-file.util';

export type KnowledgeIngestionJobData = {
  tenantId: string;
  knowledgeBaseId: string;
  documentId: string;
};

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  constructor(
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeFileStorage,
    private readonly parser: DocumentParserService,
    private readonly chunker: DocumentChunkerService,
    private readonly ragTools: RagTools,
  ) {}

  async process(data: KnowledgeIngestionJobData): Promise<void> {
    const document = await this.documents.findByIdAndTenant(
      data.documentId,
      data.tenantId,
      data.knowledgeBaseId,
    );

    if (!document) {
      return;
    }

    await this.documents.updateStatus(document.id, document.tenantId, {
      status: KNOWLEDGE_DOCUMENT_STATUS.PROCESSING,
      failureReason: null,
    });

    try {
      if (!document.source || !document.originalFilename) {
        throw new NonRetryableIngestionError(
          'The original file is missing and cannot be processed.',
        );
      }

      const absolutePath = this.storage.getAbsolutePath(
        document.tenantId,
        document.knowledgeBaseId,
        document.id,
        document.originalFilename,
      );

      const buffer = await readFile(absolutePath);
      const sourceType = detectKnowledgeSourceType(
        document.originalFilename,
        buffer,
        document.mimeType,
      );
      const text = await this.parser.extractText(sourceType, buffer);
      const chunks = this.chunker.chunk(text);

      if (chunks.length === 0) {
        throw new NonRetryableIngestionError(
          'No text could be extracted from the document.',
        );
      }

      await this.documents.deleteChunksForDocument(
        document.tenantId,
        document.id,
      );
      const rows: Array<{
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
      }> = [];
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        const embedding = await this.ragTools.embedText(content);
        rows.push({
          tenantId: document.tenantId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          source: document.source,
          sourceType,
          docType: document.mimeType,
          content,
          chunkIndex: String(index),
          embedding,
          embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
        });
      }

      await this.documents.insertChunks(rows);
      await this.documents.updateStatus(document.id, document.tenantId, {
        status: KNOWLEDGE_DOCUMENT_STATUS.INDEXED,
        failureReason: null,
      });
    } catch (error) {
      this.logger.warn(
        `Knowledge document ingestion failed for ${document.id}: ${toSafeFailureReason(error)}`,
      );

      if (error instanceof NonRetryableIngestionError) {
        await this.markFailed(data, error);
        return;
      }

      throw error;
    }
  }

  async markFailed(
    data: KnowledgeIngestionJobData,
    error: unknown,
  ): Promise<void> {
    const reason = toSafeFailureReason(error);
    await this.documents.updateStatus(data.documentId, data.tenantId, {
      status: KNOWLEDGE_DOCUMENT_STATUS.FAILED,
      failureReason: reason || 'Document processing failed.',
    });
  }
}
