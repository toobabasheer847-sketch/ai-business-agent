import { Injectable, NotFoundException } from '@nestjs/common';

import { MessageRepository } from './message.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
  ) {}

  /**
   * List all messages in a conversation.
   * Verifies the conversation belongs to the tenant before returning.
   */
  async findAll(tenantId: string, query: MessageQueryDto) {
    const conv = await this.messageRepository.findConversationByIdAndTenant(
      query.conversationId,
      tenantId,
    );

    if (!conv) {
      throw new NotFoundException('Conversation not found.');
    }

    return this.messageRepository.findAllByConversation(
      query.conversationId,
      tenantId,
      query.role,
    );
  }

  /**
   * Get a single message by UUID.
   * Tenant-scoped — will not return messages from another tenant.
   */
  async findOne(tenantId: string, id: string) {
    const message = await this.messageRepository.findByIdAndTenant(id, tenantId);

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    return message;
  }

  /**
   * Create a new message.
   * Verifies the target conversation belongs to the tenant first.
   * userId is from the authenticated user — never from the request body.
   */
  async create(tenantId: string, userId: string, dto: CreateMessageDto) {
    const conv = await this.messageRepository.findConversationByIdAndTenant(
      dto.conversationId!,
      tenantId,
    );

    if (!conv) {
      throw new NotFoundException('Conversation not found.');
    }

    return this.messageRepository.create({
      tenantId,
      conversationId: dto.conversationId!,
      userId,
      role: dto.role!,
      content: dto.content!,
      metadata: dto.metadata,
      tokenCount: dto.tokenCount,
    });
  }

  /**
   * Update non-content message fields (tokenCount, metadata).
   * Content and role are immutable after creation.
   */
  async update(tenantId: string, id: string, dto: UpdateMessageDto) {
    const existing = await this.messageRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Message not found.');
    }

    return this.messageRepository.update(id, tenantId, {
      tokenCount: dto.tokenCount,
      metadata: dto.metadata,
    });
  }

  /**
   * Delete a message by UUID (tenant-scoped).
   */
  async remove(tenantId: string, id: string) {
    const existing = await this.messageRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('Message not found.');
    }

    await this.messageRepository.delete(id, tenantId);

    return {
      message: 'Message deleted successfully.',
      id,
    };
  }
}
