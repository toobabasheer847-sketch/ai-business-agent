import { Injectable, NotFoundException } from '@nestjs/common';

import { ConversationRepository } from './conversation.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  // ─── Conversations ────────────────────────────────────────────────────────

  async create(tenantId: string, userId: string, dto: CreateConversationDto) {
    return this.conversationRepository.create({
      tenantId,
      userId,
      prospectId: dto.prospectId,
      title: dto.title?.trim(),
      channel: dto.channel,
      summary: dto.summary?.trim(),
    });
  }

  async findAll(
    tenantId: string,
    query: {
      channel?: any;
      status?: any;
      prospectId?: string;
      search?: string;
    },
  ) {
    return this.conversationRepository.findAllByTenant(tenantId, query);
  }

  async findOne(tenantId: string, id: string) {
    const conversation = await this.conversationRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async update(tenantId: string, id: string, dto: UpdateConversationDto) {
    const existing = await this.conversationRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Conversation not found');
    }

    return this.conversationRepository.update(id, tenantId, {
      title: dto.title !== undefined ? (dto.title?.trim() ?? null) : undefined,
      channel: dto.channel,
      status: dto.status,
      summary: dto.summary !== undefined ? (dto.summary?.trim() ?? null) : undefined,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.conversationRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Conversation not found');
    }

    await this.conversationRepository.delete(id, tenantId);

    return {
      message: 'Conversation deleted successfully',
      id,
    };
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async getMessages(tenantId: string, conversationId: string) {
    // Verify the conversation belongs to this tenant before returning messages
    const conversation = await this.conversationRepository.findByIdAndTenant(
      conversationId,
      tenantId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.conversationRepository.findMessagesByConversation(
      conversationId,
      tenantId,
    );
  }

  async addMessage(
    tenantId: string,
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    // Verify the conversation belongs to this tenant
    const conversation = await this.conversationRepository.findByIdAndTenant(
      conversationId,
      tenantId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.conversationRepository.createMessage({
      tenantId,
      conversationId,
      userId,
      role: dto.role,
      content: dto.content,
      metadata: dto.metadata,
      tokenCount: dto.tokenCount,
    });
  }
}
