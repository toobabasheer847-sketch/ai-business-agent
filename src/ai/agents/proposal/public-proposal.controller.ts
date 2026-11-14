import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { RejectPublicProposalDto } from './dto/reject-public-proposal.dto.js';
import { isWellFormedProposalToken } from './proposal-access-token.js';
import { PublicProposalAccessService } from './public-proposal-access.service.js';
import { PublicProposalRateLimitGuard } from './public-proposal-rate-limit.js';

/**
 * Unauthenticated client review. The token is the only credential.
 * Tenant and proposal ids are never accepted from the request.
 */
@Controller('public/proposals')
@UseGuards(PublicProposalRateLimitGuard)
export class PublicProposalController {
  constructor(private readonly publicProposalAccess: PublicProposalAccessService) {}

  @Get(':token')
  @Header('Cache-Control', 'private, no-store')
  get(@Param('token') token: string) {
    this.assertTokenShape(token);
    return this.publicProposalAccess.getProposal(token);
  }

  @Get(':token/pdf')
  @Header('Cache-Control', 'private, no-store')
  async pdf(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    this.assertTokenShape(token);
    const file = await this.publicProposalAccess.downloadPdf(token);
    const filename = file.filename.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(file.buffer);
  }

  @Post(':token/accept')
  @Header('Cache-Control', 'private, no-store')
  accept(@Param('token') token: string) {
    this.assertTokenShape(token);
    return this.publicProposalAccess.accept(token);
  }

  @Post(':token/reject')
  @Header('Cache-Control', 'private, no-store')
  reject(@Param('token') token: string, @Body() dto: RejectPublicProposalDto) {
    this.assertTokenShape(token);
    return this.publicProposalAccess.reject(token, dto.reason);
  }

  private assertTokenShape(token: string): void {
    if (!isWellFormedProposalToken(token?.trim() ?? '')) {
      throw new NotFoundException('Proposal link not found');
    }
  }
}
