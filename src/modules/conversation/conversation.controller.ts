import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ConversationService } from './conversation.service';
import { CreateConversationDto, ConversationChannel, ConversationStatus } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  private getUser(req: Request): AuthenticatedUser {
    return req.user as AuthenticatedUser;
  }

  // ─── Conversations ────────────────────────────────────────────────────────

  /**
   * POST /api/conversations
   * Create a new conversation for the authenticated tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateConversationDto,
  ) {
    const user = this.getUser(req);
    return this.conversationService.create(user.tenantId, user.userId, dto);
  }

  /**
   * GET /api/conversations
   * List all conversations for the authenticated tenant.
   * Optional filters: channel, status, prospectId, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('channel') channel?: ConversationChannel,
    @Query('status') status?: ConversationStatus,
    @Query('prospectId') prospectId?: string,
    @Query('search') search?: string,
  ) {
    return this.conversationService.findAll(this.getUser(req).tenantId, {
      channel,
      status,
      prospectId,
      search,
    });
  }

  /**
   * GET /api/conversations/:id
   * Get a single conversation by UUID.
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversationService.findOne(this.getUser(req).tenantId, id);
  }

  /**
   * PATCH /api/conversations/:id
   * Update title, channel, status, or summary.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationService.update(this.getUser(req).tenantId, id, dto);
  }

  /**
   * DELETE /api/conversations/:id
   * Delete a conversation and its messages (cascade via DB).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversationService.remove(this.getUser(req).tenantId, id);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /**
   * GET /api/conversations/:id/messages
   * List all messages in a conversation (tenant-scoped).
   */
  @Get(':id/messages')
  async getMessages(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversationService.getMessages(this.getUser(req).tenantId, id);
  }

  /**
   * POST /api/conversations/:id/messages
   * Add a message to a conversation.
   */
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async addMessage(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const user = this.getUser(req);
    return this.conversationService.addMessage(user.tenantId, id, user.userId, dto);
  }
}
