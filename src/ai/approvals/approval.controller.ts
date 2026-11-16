import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../modules/auth/types/auth.types';
import { hasAnyPermission, Permission } from '../../modules/authorization/permissions';
import { ApprovalService } from './approval.service';
import type { ApprovalRecord } from './approval.types';

class RejectApprovalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class EditApprovalDto {
  @IsOptional()
  @IsObject()
  edits?: Record<string, string>;
}

@UseGuards(JwtAuthGuard)
@Controller('ai-approvals')
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    this.assertReader(req);
    return this.approvals.summary(req.user);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('actionType') actionType?: string,
    @Query('agent') agent?: string,
    @Query('requesterUserId') requesterUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('direction') direction?: string,
  ) {
    this.assertReader(req);
    return this.approvals.list(req.user, { page, limit, status, riskLevel, actionType, agent, requesterUserId, from, to, sort, direction })
      .then((pageResult) => ({ ...pageResult, data: pageResult.data.map(present) }));
  }

  @Get(':id/events')
  events(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.assertReader(req);
    return this.approvals.events(req.user, id);
  }

  @Get(':id')
  find(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.assertReader(req);
    return this.approvals.find(req.user, id).then(present);
  }

  @Post(':id/approve')
  approve(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.assertReader(req);
    return this.approvals.approve(req.user, id).then(present);
  }

  @Post(':id/edit-approve')
  editApprove(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: EditApprovalDto) {
    this.assertReader(req);
    return this.approvals.approve(req.user, id, dto.edits).then(present);
  }

  @Post(':id/reject')
  reject(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RejectApprovalDto) {
    this.assertReader(req);
    return this.approvals.reject(req.user, id, dto.reason).then(present);
  }

  @Post(':id/cancel')
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.assertReader(req);
    return this.approvals.cancel(req.user, id).then(present);
  }

  private assertReader(req: AuthenticatedRequest) {
    if (!hasAnyPermission(req.user.role, [Permission.AuditView, Permission.AssistantUse])) {
      throw new ForbiddenException('You do not have access to the approval center.');
    }
  }
}

function present(row: ApprovalRecord) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requesterUserId: row.requesterUserId,
    approverUserId: row.approverUserId,
    agentRunId: row.agentRunId,
    agentName: row.agentName,
    actionType: row.actionType,
    title: row.title,
    description: row.description,
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    originalPayload: row.originalPayload,
    approvedPayload: row.approvedPayload,
    status: row.status,
    riskLevel: row.riskLevel,
    reason: row.reason,
    rejectionReason: row.rejectionReason,
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    executedAt: row.executedAt?.toISOString() ?? null,
    executionReference: row.executionReference,
    errorSummary: row.errorSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
