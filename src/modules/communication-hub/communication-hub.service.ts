import { Injectable, NotFoundException } from '@nestjs/common';

import { CommunicationHubRepository } from './communication-hub.repository';
import {
  GetCommunicationHistoryDto,
  CommunicationChannel,
  CommunicationDirection,
} from './dto/communication-history.dto';

@Injectable()
export class CommunicationHubService {
  constructor(
    private readonly communicationHubRepository: CommunicationHubRepository,
  ) {}

  async getHistory(tenantId: string, dto: GetCommunicationHistoryDto) {
    return this.communicationHubRepository.listHistory(tenantId, {
      channel: dto.channel,
      direction: dto.direction,
      prospectId: dto.prospectId,
      search: dto.search,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    });
  }

  async getConversationDetail(tenantId: string, conversationId: string) {
    const detail = await this.communicationHubRepository.findConversationById(
      tenantId,
      conversationId,
    );

    if (!detail) {
      throw new NotFoundException('Conversation not found');
    }

    return detail;
  }

  async getEmailThreads(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      prospectId?: string;
      search?: string;
    },
  ) {
    return this.communicationHubRepository.listEmailThreads(tenantId, options);
  }

  async getSmsThreads(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      prospectId?: string;
      search?: string;
    },
  ) {
    return this.communicationHubRepository.listSmsThreads(tenantId, options);
  }

  async getStats(tenantId: string) {
    return this.communicationHubRepository.getStats(tenantId);
  }
}
