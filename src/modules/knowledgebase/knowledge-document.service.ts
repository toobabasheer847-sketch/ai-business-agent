import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { KnowledgebaseRepository } from './knowledgebase.repository';
import { DocumentIngestionService } from './document-ingestion.service';
import {
  KNOWLEDGE_DOCUMENT_STATUS,
  MAX_KNOWLEDGE_FILE_BYTES,
  RAG_EMBEDDING_JOB_NAME,
} from './knowledge-document.constants';
import { KnowledgeDocumentRepository } from './knowledge-document.repository';
import { KnowledgeFileStorage } from './knowledge-file.storage';
import {
  detectKnowledgeSourceType,
  sanitizeKnowledgeFilename,
} from './knowledge-file.util';

type UploadedKnowledgeFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private readonly knowledgebases: KnowledgebaseRepository,
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeFileStorage,
    private readonly ingestion: DocumentIngestionService,
    @InjectQueue(QUEUE_NAMES.RAG_EMBEDDING)
    private readonly ragEmbeddingQueue: Queue,
  ) {}

  async list(tenantId: string, knowledgeBaseId: string) {
    await this.requireKnowledgeBase(tenantId, knowledgeBaseId);
    return this.documents.findAllByKnowledgeBase(tenantId, knowledgeBaseId);
  }

  async upload(
    tenantId: string,
    knowledgeBaseId: string,
    file?: UploadedKnowledgeFile,
  ) {
    await this.requireKnowledgeBase(tenantId, knowledgeBaseId);

    if (!file?.buffer) {
      throw new BadRequestException('A file is required.');
    }

    if (file.size > MAX_KNOWLEDGE_FILE_BYTES || file.buffer.length > MAX_KNOWLEDGE_FILE_BYTES) {
      throw new BadRequestException(
        `File exceeds the maximum size of ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)}MB.`,
      );
    }

    const filename = sanitizeKnowledgeFilename(file.originalname);
    detectKnowledgeSourceType(filename, file.buffer, file.mimetype);

    const documentId = randomUUID();
    const stored = await this.storage.save({
      tenantId,
      knowledgeBaseId,
      documentId,
      filename,
      buffer: file.buffer,
    });

    const document = await this.documents.create({
      id: documentId,
      tenantId,
      knowledgeBaseId,
      title: filename,
      originalFilename: filename,
      source: stored.storageKey,
      mimeType: file.mimetype || null,
      byteSize: file.buffer.length,
      status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
    });

    try {
      await this.ragEmbeddingQueue.add(
        RAG_EMBEDDING_JOB_NAME,
        {
          tenantId,
          knowledgeBaseId,
          documentId,
        },
        {
          jobId: `knowledge-document-${documentId}`,
        },
      );
    } catch {
      this.processInBackground(tenantId, knowledgeBaseId, documentId);
    }

    return this.documents.findByIdAndTenant(
      documentId,
      tenantId,
      knowledgeBaseId,
    ) ?? document;
  }

  async retry(tenantId: string, knowledgeBaseId: string, documentId: string) {
    const document = await this.requireDocument(
      tenantId,
      knowledgeBaseId,
      documentId,
    );

    if (document.status !== KNOWLEDGE_DOCUMENT_STATUS.FAILED) {
      throw new BadRequestException(
        'Only failed documents can be retried.',
      );
    }

    await this.documents.updateStatus(document.id, tenantId, {
      status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
      failureReason: null,
    });

    try {
      await this.ragEmbeddingQueue.add(
        RAG_EMBEDDING_JOB_NAME,
        {
          tenantId,
          knowledgeBaseId,
          documentId: document.id,
        },
        {
          jobId: `knowledge-document-${document.id}-${Date.now()}`,
        },
      );
    } catch {
      this.processInBackground(tenantId, knowledgeBaseId, document.id);
    }

    return this.documents.findByIdAndTenant(
      document.id,
      tenantId,
      knowledgeBaseId,
    );
  }

  async remove(tenantId: string, knowledgeBaseId: string, documentId: string) {
    const document = await this.requireDocument(
      tenantId,
      knowledgeBaseId,
      documentId,
    );

    await this.documents.deleteChunksForDocument(tenantId, document.id);
    await this.documents.delete(document.id, tenantId, knowledgeBaseId);
    await this.storage.removeDocumentDir(
      tenantId,
      knowledgeBaseId,
      document.id,
    );

    return {
      message: 'Document deleted successfully.',
      id: document.id,
    };
  }

  private async requireKnowledgeBase(tenantId: string, knowledgeBaseId: string) {
    const knowledgebase = await this.knowledgebases.findByIdAndTenant(
      knowledgeBaseId,
      tenantId,
    );

    if (!knowledgebase) {
      throw new NotFoundException('Knowledgebase not found.');
    }

    return knowledgebase;
  }

  private async requireDocument(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string,
  ) {
    await this.requireKnowledgeBase(tenantId, knowledgeBaseId);

    const document = await this.documents.findByIdAndTenant(
      documentId,
      tenantId,
      knowledgeBaseId,
    );

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    return document;
  }

  private processInBackground(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string,
  ): void {
    void this.ingestion
      .process({ tenantId, knowledgeBaseId, documentId })
      .catch((error) =>
        this.ingestion.markFailed(
          { tenantId, knowledgeBaseId, documentId },
          error,
        ),
      );
  }
}
