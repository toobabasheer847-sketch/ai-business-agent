import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { RagModule } from '../../ai/agents/rag/rag.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { DocumentChunkerService } from './document-chunker.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentParserService } from './document-parser.service';
import { KnowledgeDocumentController } from './knowledge-document.controller';
import { KnowledgeDocumentRepository } from './knowledge-document.repository';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeFileStorage } from './knowledge-file.storage';
import { KnowledgebaseController } from './knowledgebase.controller';
import { KnowledgebaseRepository } from './knowledgebase.repository';
import { KnowledgebaseService } from './knowledgebase.service';
import { RagEmbeddingProcessor } from './rag-embedding.processor';

@Module({
  imports: [
    RagModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.RAG_EMBEDDING }),
  ],
  controllers: [KnowledgebaseController, KnowledgeDocumentController],
  providers: [
    KnowledgebaseService,
    KnowledgebaseRepository,
    KnowledgeDocumentService,
    KnowledgeDocumentRepository,
    KnowledgeFileStorage,
    DocumentParserService,
    DocumentChunkerService,
    DocumentIngestionService,
    RagEmbeddingProcessor,
  ],
  exports: [KnowledgebaseService, KnowledgebaseRepository],
})
export class KnowledgebaseModule {}
