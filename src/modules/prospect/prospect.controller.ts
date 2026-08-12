import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ProspectService } from './prospect.service';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { ProspectQueryDto } from './dto/prospect-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('prospects')
export class ProspectController {
  constructor(
    private readonly prospectService: ProspectService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * POST /api/prospects
   * Create a new prospect for the authenticated tenant.
   * tenantId comes from the JWT — never from the request body.
   * companyId and leadId must belong to the same tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateProspectDto,
  ) {
    return this.prospectService.create(this.getTenantId(req), dto);
  }

  /**
   * GET /api/prospects
   * List prospects for the authenticated tenant.
   * Optional filters: status, companyId, leadId, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: ProspectQueryDto,
  ) {
    return this.prospectService.findAll(this.getTenantId(req), query);
  }

  /**
   * GET /api/prospects/:id
   * Get a single prospect by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prospectService.findOne(this.getTenantId(req), id);
  }

  /**
   * PATCH /api/prospects/:id
   * Update a prospect (tenant-scoped).
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.prospectService.update(this.getTenantId(req), id, dto);
  }

  /**
   * DELETE /api/prospects/:id
   * Delete a prospect (tenant-scoped).
   * Related proposals cascade-delete via DB FK.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prospectService.remove(this.getTenantId(req), id);
  }
}
