
import {
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { RagQueryDto } from './dto/rag-query.dto';
import { RagService } from './rag.service';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId?: string;
    id?: string;
    email?: string;
  };
}

@Controller('api/ai/rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
  ) {}

  @Post('query')
  async query(
    @Body() dto: RagQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user?.tenantId;

    return this.ragService.query(dto, tenantId);
  }
}

