import {
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagService } from './rag.service';

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
