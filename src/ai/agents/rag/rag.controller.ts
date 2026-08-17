import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagService } from './rag.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
  ) {}

  @Post('query')
  async query(
    @Body() dto: RagQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;

    return this.ragService.query(dto, tenantId);
  }
}
