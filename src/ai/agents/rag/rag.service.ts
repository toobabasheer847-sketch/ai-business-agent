
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { RagAgent } from './rag.agent';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagResponse } from './types/rag.types';

@Injectable()
export class RagService {
  constructor(
    private readonly ragAgent: RagAgent,
  ) {}

  async query(
    dto: RagQueryDto | undefined,
    tenantId?: string,
  ): Promise<RagResponse> {
    const queryText = dto?.query?.trim();

    if (!queryText) {
      throw new BadRequestException('Query is required');
    }

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant context is required',
      );
    }

    try {
      return await this.ragAgent.answerQuery(
        tenantId,
        queryText,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown RAG error';

      console.error('RagService.query failed:', error);

      throw new InternalServerErrorException(
        `RAG query failed: ${message}`,
      );
    }
  }
}
