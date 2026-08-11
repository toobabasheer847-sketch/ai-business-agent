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

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { UpdateProposalDto } from './dto/update-proposal.dto.js';
import { ProposalQueryDto } from './dto/proposal-query.dto.js';
import { GenerateProposalDto } from './dto/generate-proposal.dto.js';
import { ChangeProposalStatusDto } from './dto/change-proposal-status.dto.js';
import { ProposalService } from './proposal.service.js';

@Controller('api/ai/proposals')
@UseGuards(JwtAuthGuard)
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  @Post()
  async create(@Body() dto: CreateProposalDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.proposalService.createProposal(dto, context);
  }

  @Get()
  async list(@Query() dto: ProposalQueryDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.proposalService.listProposals(dto, context);
  }

  @Get(':proposalId')
  async get(@Param('proposalId') proposalId: string, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.proposalService.getProposal(proposalId, context);
  }

  @Patch(':proposalId')
  async update(
    @Param('proposalId') proposalId: string,
    @Body() dto: UpdateProposalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.updateProposal(proposalId, dto, context);
  }

  @Post(':proposalId/generate')
  async generate(
    @Param('proposalId') proposalId: string,
    @Body() dto: GenerateProposalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.generateProposal(proposalId, dto, context);
  }

  @Post(':proposalId/status')
  async changeStatus(
    @Param('proposalId') proposalId: string,
    @Body() dto: ChangeProposalStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.proposalService.changeProposalStatus(proposalId, dto, context);
  }

  @Post('agent')
  async agent(@Body('message') message: string, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.proposalService.processNaturalLanguage(message, context);
  }

  private buildContext(req: AuthenticatedRequest) {
    const user = req.user;
    return {
      userId: user?.userId ?? '',
      tenantId: user?.tenantId ?? '',
      email: user?.email,
    };
  }
}
