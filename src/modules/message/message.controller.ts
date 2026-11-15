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
import { hasPermission, Permission } from '../authorization/permissions';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
  ) {}

  private getUser(req: Request): AuthenticatedUser {
    return req.user as AuthenticatedUser;
  }

  private scopeUserId(user: AuthenticatedUser): string | undefined {
    return hasPermission(user.role, Permission.CommunicationView) ? undefined : user.userId;
  }

  /**
   * GET /api/messages?conversationId=<uuid>&role=<role>
   * List all messages in a conversation (tenant-scoped).
   * conversationId is required. role is an optional filter.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: MessageQueryDto,
  ) {
    const user = this.getUser(req);
    return this.messageService.findAll(user.tenantId, query, this.scopeUserId(user));
  }

  /**
   * GET /api/messages/:id
   * Get a single message by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = this.getUser(req);
    return this.messageService.findOne(user.tenantId, id, this.scopeUserId(user));
  }

  /**
   * POST /api/messages
   * Create a new message in a conversation.
   * tenantId and userId are taken from the JWT — never from the body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateMessageDto,
  ) {
    const user = this.getUser(req);
    return this.messageService.create(user.tenantId, user.userId, dto, this.scopeUserId(user));
  }

  /**
   * PATCH /api/messages/:id
   * Update non-content metadata fields (tokenCount, metadata).
   * Content and role are immutable after creation.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    const user = this.getUser(req);
    return this.messageService.update(user.tenantId, id, dto, this.scopeUserId(user));
  }

  /**
   * DELETE /api/messages/:id
   * Delete a message (tenant-scoped).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = this.getUser(req);
    return this.messageService.remove(user.tenantId, id, this.scopeUserId(user));
  }
}
