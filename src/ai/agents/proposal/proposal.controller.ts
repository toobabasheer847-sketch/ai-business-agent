import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../../../common/guards/auth.guard.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { UpdateProposalDto } from './dto/update-proposal.dto.js';
import { ProposalQueryDto } from './dto/proposal-query.dto.js';
import { GenerateProposalDto } from './dto/generate-proposal.dto.js';
import { ChangeProposalStatusDto } from './dto/change-proposal-status.dto.js';
import { ProposalService } from './proposal.service.js';

@Controller('api/ai/proposals')
@UseGuards(AuthGuard)
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  @Post()
  async create(@Body() dto: CreateProposalDto, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.proposalService.createProposal(dto, context);
  }

  @Get()
  async list(@Query() dto: ProposalQueryDto, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.proposalService.listProposals(dto, context);
  }

  @Get(':proposalId')
  async get(@Param('proposalId') proposalId: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.proposalService.getProposal(proposalId, context);
  }

  @Patch(':proposalId')
  async update(
    @Param('proposalId') proposalId: string,
    @Body() dto: UpdateProposalDto,
    @Req() req: Request,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.updateProposal(proposalId, dto, context);
  }

  @Post(':proposalId/generate')
  async generate(
    @Param('proposalId') proposalId: string,
    @Body() dto: GenerateProposalDto,
    @Req() req: Request,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.generateProposal(proposalId, dto, context);
  }

  @Post(':proposalId/status')
  async changeStatus(
    @Param('proposalId') proposalId: string,
    @Body() dto: ChangeProposalStatusDto,
    @Req() req: Request,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.changeProposalStatus(proposalId, dto, context);
  }

  @Post('agent')
  async agent(@Body('message') message: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.proposalService.processNaturalLanguage(message, context);
  }

  private buildContext(req: Request) {
    const user = (req as Request & {
      user?: { id?: string; tenantId?: string; email?: string };
    }).user;
    return {
      userId: user?.id ?? '',
      tenantId: user?.tenantId ?? '',
      email: user?.email,
    };
  }
}
