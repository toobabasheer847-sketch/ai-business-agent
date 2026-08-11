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
import { ProposalService } from './proposal.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ProposalQueryDto } from './dto/proposal-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalController {
  constructor(
    private readonly proposalService: ProposalService,
  ) {}

  private getUser(req: Request): AuthenticatedUser {
    return req.user as AuthenticatedUser;
  }

  /**
   * POST /api/proposals
   * Create a new proposal for the authenticated tenant.
   * tenantId and createdBy come from the JWT — never from the request body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateProposalDto,
  ) {
    const user = this.getUser(req);
    return this.proposalService.create(user.tenantId, user.userId, dto);
  }

  /**
   * GET /api/proposals
   * List proposals for the authenticated tenant.
   * Optional filters: status, prospectId, createdBy, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: ProposalQueryDto,
  ) {
    return this.proposalService.findAll(this.getUser(req).tenantId, query);
  }

  /**
   * GET /api/proposals/:id
   * Get a single proposal by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proposalService.findOne(this.getUser(req).tenantId, id);
  }

  /**
   * PATCH /api/proposals/:id
   * Update an existing proposal (tenant-scoped).
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProposalDto,
  ) {
    return this.proposalService.update(this.getUser(req).tenantId, id, dto);
  }

  /**
   * DELETE /api/proposals/:id
   * Delete a proposal (tenant-scoped).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proposalService.remove(this.getUser(req).tenantId, id);
  }
}
