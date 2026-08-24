import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types';
import { ChatMessageDto } from './dto/chat-message.dto';
import { MasterAgentService } from './master.service';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class MasterAgentController {
  constructor(private readonly masterAgentService: MasterAgentService) {}

  @Get('master/status')
  getStatus() {
    const agent = this.masterAgentService.getAgent();

    return {
      status: 'success',
      agent: agent.name,
    };
  }

  @Get('conversations')
  async listConversations(@Req() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.requireAuthContext(req);
    return this.masterAgentService.listAssistantConversations(tenantId, userId);
  }

  @Get('conversations/:id/messages')
  async listConversationMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.requireAuthContext(req);
    return this.masterAgentService.getAssistantConversationMessages(
      tenantId,
      userId,
      conversationId,
    );
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.requireAuthContext(req);
    await this.masterAgentService.deleteAssistantConversation(
      tenantId,
      userId,
      conversationId,
    );
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatMessageDto, @Req() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.requireAuthContext(req);

    return this.masterAgentService.invoke(
      tenantId,
      userId,
      dto.message,
      dto.conversationId,
    );
  }

  private requireAuthContext(req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return { tenantId, userId };
  }
}
