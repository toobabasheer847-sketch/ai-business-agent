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
import { KnowledgebaseService } from './knowledgebase.service';
import { CreateKnowledgebaseDto } from './dto/create-knowledgebase.dto';
import { UpdateKnowledgebaseDto } from './dto/update-knowledgebase.dto';

@UseGuards(JwtAuthGuard)
@Controller('knowledgebases')
export class KnowledgebaseController {
  constructor(
    private readonly knowledgebaseService: KnowledgebaseService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**

   * POST /api/knowledgebases
   * Create a new knowledgebase for the authenticated tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateKnowledgebaseDto,
  ) {
    return this.knowledgebaseService.create(this.getTenantId(req), dto);
  }

  /**
   * GET /api/knowledgebases
   * List all knowledgebases for the authenticated tenant.
   * Optional: ?search= to filter by name.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('search') search?: string,
  ) {
    return this.knowledgebaseService.findAll(this.getTenantId(req), search);
  }

  /**
   * GET /api/knowledgebases/:id
   * Get a single knowledgebase by UUID.
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgebaseService.findOne(this.getTenantId(req), id);
  }

  /**
   * PATCH /api/knowledgebases/:id
   * Update a knowledgebase's name or description.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgebaseDto,
  ) {
    return this.knowledgebaseService.update(this.getTenantId(req), id, dto);
  }

  /**
   * DELETE /api/knowledgebases/:id
   * Delete a knowledgebase.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgebaseService.remove(this.getTenantId(req), id);
  }
}
