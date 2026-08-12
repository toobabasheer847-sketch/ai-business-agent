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
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * GET /api/tenants
   * Returns the authenticated tenant (from JWT). Never accepts tenantId from the client.
   */
  @Get()
  async get(@Req() req: Request) {
    return this.tenantService.getAuthenticatedTenant(this.getTenantId(req));
  }

  /**
   * PATCH /api/tenants
   * Updates the authenticated tenant. Only fields present in the schema are editable.
   */
  @Patch()
  async update(
    @Req() req: Request,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.updateAuthenticatedTenant(
      this.getTenantId(req),
      dto,
    );
  }
}
