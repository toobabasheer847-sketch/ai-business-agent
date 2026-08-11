import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { MasterSettingsService } from './master-settings.service';
import { UpdateMasterSettingsDto } from './dto/update-master-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('master-settings')
export class MasterSettingsController {
  constructor(
    private readonly masterSettingsService: MasterSettingsService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * GET /api/master-settings
   * Returns the authenticated tenant's master settings.
   * Auto-creates a record with sensible defaults if one does not yet exist.
   */
  @Get()
  async get(@Req() req: Request) {
    return this.masterSettingsService.getOrCreate(this.getTenantId(req));
  }

  /**
   * PATCH /api/master-settings
   * Updates the authenticated tenant's master settings.
   * All fields are optional — only supplied fields are changed.
   * Auto-creates a record with defaults first if one does not yet exist.
   */
  @Patch()
  async update(
    @Req() req: Request,
    @Body() dto: UpdateMasterSettingsDto,
  ) {
    return this.masterSettingsService.update(this.getTenantId(req), dto);
  }
}
