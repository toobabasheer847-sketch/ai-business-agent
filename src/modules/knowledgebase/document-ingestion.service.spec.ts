import { mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DocumentChunkerService } from './document-chunker.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentParserService } from './document-parser.service';
import { KNOWLEDGE_DOCUMENT_STATUS } from './knowledge-document.constants';
import { KnowledgeDocumentRepository } from './knowledge-document.repository';
import { KnowledgeFileStorage } from './knowledge-file.storage';

describe('DocumentIngestionService', () => {
  let service: DocumentIngestionService;
  let documents: jest.Mocked<KnowledgeDocumentRepository>;
  let storage: KnowledgeFileStorage;
  let parser: DocumentParserService;
  let chunker: DocumentChunkerService;
  let ragTools: { embedText: jest.Mock };
  let tempRoot: string;

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const knowledgeBaseId = '22222222-2222-4222-8222-222222222222';
  const documentId = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    tempRoot = path.join(
      os.tmpdir(),
      `kb-ingest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(tempRoot, { recursive: true });

    documents = {
      findByIdAndTenant: jest.fn(),
      updateStatus: jest.fn(),
      deleteChunksForDocument: jest.fn(),
      insertChunks: jest.fn(),
    } as unknown as jest.Mocked<KnowledgeDocumentRepository>;

    storage = new KnowledgeFileStorage({
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'KNOWLEDGE_STORAGE_DIR') {
          return tempRoot;
        }
        return fallback;
      }),
    } as any);

    parser = new DocumentParserService();
    chunker = new DocumentChunkerService();
    ragTools = {
      embedText: jest.fn(async (content: string) =>
        Array.from({ length: 8 }, (_, index) => content.length + index),
      ),
    };

    service = new DocumentIngestionService(
      documents,
      storage,
      parser,
      chunker,
      ragTools as any,
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('no-ops when the document is missing', async () => {
    documents.findByIdAndTenant.mockResolvedValue(undefined);

    await service.process({ tenantId, knowledgeBaseId, documentId });

    expect(documents.updateStatus).not.toHaveBeenCalled();
  });

  it('indexes a document through parse → chunk → embed', async () => {
    const filename = 'policy.txt';
    const absolutePath = path.join(
      tempRoot,
      tenantId,
      knowledgeBaseId,
      documentId,
      filename,
    );
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      'Phase 6 ingestion test content.\n\nSecond paragraph for chunking.',
    );

    documents.findByIdAndTenant.mockResolvedValue({
      id: documentId,
      tenantId,
      knowledgeBaseId,
      title: filename,
      originalFilename: filename,
      source: `${tenantId}/${knowledgeBaseId}/${documentId}/${filename}`,
      mimeType: 'text/plain',
      byteSize: 64,
      status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
      failureReason: null,
      content: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await service.process({ tenantId, knowledgeBaseId, documentId });

    expect(documents.updateStatus).toHaveBeenCalledWith(
      documentId,
      tenantId,
      expect.objectContaining({ status: KNOWLEDGE_DOCUMENT_STATUS.PROCESSING }),
    );
    expect(documents.deleteChunksForDocument).toHaveBeenCalledWith(
      tenantId,
      documentId,
    );
    expect(ragTools.embedText).toHaveBeenCalled();
    expect(documents.insertChunks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId,
          knowledgeBaseId,
          documentId,
          embeddingModel: 'gemini-embedding-001',
        }),
      ]),
    );
    expect(documents.updateStatus).toHaveBeenLastCalledWith(
      documentId,
      tenantId,
      expect.objectContaining({ status: KNOWLEDGE_DOCUMENT_STATUS.INDEXED }),
    );
  });

  it('marks failed documents for non-retryable parser errors', async () => {
    const filename = 'empty.txt';
    const absolutePath = path.join(
      tempRoot,
      tenantId,
      knowledgeBaseId,
      documentId,
      filename,
    );
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, '   ');

    documents.findByIdAndTenant.mockResolvedValue({
      id: documentId,
      tenantId,
      knowledgeBaseId,
      title: filename,
      originalFilename: filename,
      source: `${tenantId}/${knowledgeBaseId}/${documentId}/${filename}`,
      mimeType: 'text/plain',
      status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
    } as any);

    await service.process({ tenantId, knowledgeBaseId, documentId });

    expect(documents.updateStatus).toHaveBeenLastCalledWith(
      documentId,
      tenantId,
      expect.objectContaining({ status: KNOWLEDGE_DOCUMENT_STATUS.FAILED }),
    );
  });

  it('markFailed persists a safe failure reason', async () => {
    await service.markFailed(
      { tenantId, knowledgeBaseId, documentId },
      new Error('Embedding provider unavailable'),
    );

    expect(documents.updateStatus).toHaveBeenCalledWith(
      documentId,
      tenantId,
      expect.objectContaining({
        status: KNOWLEDGE_DOCUMENT_STATUS.FAILED,
        failureReason: expect.stringContaining('Embedding provider unavailable'),
      }),
    );
  });
});
