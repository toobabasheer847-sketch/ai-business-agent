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
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * POST /api/leads
   * Create a new lead for the authenticated tenant.
   * The lead must be associated with a company that belongs to the same tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadService.create(this.getTenantId(req), dto);
  }

  /**
   * GET /api/leads
   * List all leads for the authenticated tenant.
   * Optional query filters: search, status, companyId, source.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('source') source?: string,
  ) {
    return this.leadService.findAll(this.getTenantId(req), {
      search,
      status,
      companyId,
      source,
    });
  }

  /**
   * GET /api/leads/:id
   * Get a single lead by UUID.
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadService.findOne(this.getTenantId(req), id);
  }

  /**
   * PATCH /api/leads/:id
   * Update a lead. All fields are optional.
   * If companyId is changed, the new company must belong to the same tenant.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadService.update(this.getTenantId(req), id, dto);
  }

  /**
   * DELETE /api/leads/:id
   * Delete a lead (cascades to prospects via DB).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadService.remove(this.getTenantId(req), id);
  }
}
