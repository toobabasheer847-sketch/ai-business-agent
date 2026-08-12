import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { GmailConfigurationService } from './gmail-configuration.service';
import { CreateGmailConfigurationDto } from './dto/create-gmail-configuration.dto';
import { UpdateGmailConfigurationDto } from './dto/update-gmail-configuration.dto';

@UseGuards(JwtAuthGuard)
@Controller('gmail-configuration')
export class GmailConfigurationController {
  constructor(
    private readonly gmailConfigService: GmailConfigurationService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * POST /api/gmail-configuration
   * Create the Gmail configuration for the authenticated tenant.
   * Only one configuration per tenant is allowed.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateGmailConfigurationDto,
  ) {
    return this.gmailConfigService.create(this.getTenantId(req), dto);
  }

  /**
   * GET /api/gmail-configuration
   * Get the current tenant's Gmail configuration (sensitive fields excluded).
   */
  @Get()
  async findOne(@Req() req: Request) {
    return this.gmailConfigService.findByTenant(this.getTenantId(req));
  }

  /**
   * PATCH /api/gmail-configuration
   * Update the current tenant's Gmail configuration.
   * Partial updates — only provided fields are changed.
   */
  @Patch()
  async update(
    @Req() req: Request,
    @Body() dto: UpdateGmailConfigurationDto,
  ) {
    return this.gmailConfigService.update(this.getTenantId(req), dto);
  }

  /**
   * PATCH /api/gmail-configuration/deactivate
   * Soft-deactivate the Gmail configuration without deleting credentials.
   */
  @Patch('deactivate')
  async deactivate(@Req() req: Request) {
    return this.gmailConfigService.deactivate(this.getTenantId(req));
  }

  /**
   * DELETE /api/gmail-configuration
   * Permanently delete the tenant's Gmail configuration and all stored credentials.
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: Request) {
    return this.gmailConfigService.remove(this.getTenantId(req));
  }
}
