import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  constructor(
    private readonly masterAgentService: MasterAgentService,
  ) {}

  @Get('master/status')
  getStatus() {
    const agent = this.masterAgentService.getAgent();

    return {
      status: 'success',
      agent: agent.name,
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() dto: ChatMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.masterAgentService.invoke(tenantId, dto.message);
  }
}
