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
import { ConfirmOrchestrationDto } from './dto/confirm-orchestration.dto';
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
      req.user.role,
    );
  }

  @Post('orchestrate')
  @HttpCode(HttpStatus.OK)
  async orchestrate(@Body() dto: ChatMessageDto, @Req() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.requireAuthContext(req);
    const result = await this.masterAgentService.invoke(
      tenantId,
      userId,
      dto.message,
      dto.conversationId,
      req.user.role,
    );

    return {
      success: result.orchestration ? result.orchestration.status !== 'failed' : true,
      conversationId: result.conversationId,
      message: result.response,
      response: result.response,
      delegation: result.delegation,
      orchestration: result.orchestration ?? null,
    };
  }

  @Post('orchestrate/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmOrchestration(
    @Body() dto: ConfirmOrchestrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.requireAuthContext(req);
    const result = await this.masterAgentService.confirmOrchestration(
      tenantId,
      userId,
      dto.conversationId,
      dto.orchestrationId,
      req.user.role,
    );

    return {
      success: true,
      conversationId: result.conversationId,
      message: result.response,
      response: result.response,
      delegation: result.delegation,
      orchestration: result.orchestration ?? null,
    };
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
