import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CommunicationHubService } from './communication-hub.service';
import { GetCommunicationHistoryDto } from './dto/communication-history.dto';

@UseGuards(JwtAuthGuard)
@Controller('communication-hub')
export class CommunicationHubController {
  constructor(
    private readonly communicationHubService: CommunicationHubService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * GET /api/communication-hub
   * Unified communication history across all channels.
   * Supports optional filters: channel, direction, prospectId, search, page, limit.
   */
  @Get()
  async getHistory(
    @Req() req: Request,
    @Query() dto: GetCommunicationHistoryDto,
  ) {
    return this.communicationHubService.getHistory(
      this.getTenantId(req),
      dto,
    );
  }

  /**
   * GET /api/communication-hub/stats
   * Aggregated communication stats for the tenant.
   */
  @Get('stats')
  async getStats(@Req() req: Request) {
    return this.communicationHubService.getStats(this.getTenantId(req));
  }

  /**
   * GET /api/communication-hub/email-threads
   * Email-channel conversations only.
   */
  @Get('email-threads')
  async getEmailThreads(
    @Req() req: Request,
    @Query() dto: GetCommunicationHistoryDto,
  ) {
    return this.communicationHubService.getEmailThreads(
      this.getTenantId(req),
      {
        page: dto.page ?? 1,
        limit: dto.limit ?? 20,
        prospectId: dto.prospectId,
        search: dto.search,
      },
    );
  }

  /**
   * GET /api/communication-hub/sms-threads
   * SMS-channel conversations only.
   */
  @Get('sms-threads')
  async getSmsThreads(
    @Req() req: Request,
    @Query() dto: GetCommunicationHistoryDto,
  ) {
    return this.communicationHubService.getSmsThreads(
      this.getTenantId(req),
      {
        page: dto.page ?? 1,
        limit: dto.limit ?? 20,
        prospectId: dto.prospectId,
        search: dto.search,
      },
    );
  }

  /**
   * GET /api/communication-hub/:id
   * Single conversation detail including messages.
   */
  @Get(':id')
  async getConversationDetail(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationHubService.getConversationDetail(
      this.getTenantId(req),
      id,
    );
  }
}
