import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import {
  DocumentIngestionService,
  type KnowledgeIngestionJobData,
} from './document-ingestion.service';
import { NonRetryableIngestionError } from './document-parser.service';
import { RAG_EMBEDDING_JOB_NAME } from './knowledge-document.constants';

@Processor(QUEUE_NAMES.RAG_EMBEDDING)
export class RagEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(RagEmbeddingProcessor.name);

  constructor(private readonly ingestion: DocumentIngestionService) {
    super();
  }

  async process(job: Job<KnowledgeIngestionJobData>): Promise<void> {
    if (job.name !== RAG_EMBEDDING_JOB_NAME) {
      return;
    }

    try {
      await this.ingestion.process(job.data);
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= attempts;

      if (error instanceof NonRetryableIngestionError || isLastAttempt) {
        await this.ingestion.markFailed(job.data, error);
      }

      if (error instanceof NonRetryableIngestionError) {
        this.logger.warn(
          `Non-retryable knowledge ingestion failure for document ${job.data.documentId}`,
        );
        return;
      }

      throw error;
    }
  }
}
