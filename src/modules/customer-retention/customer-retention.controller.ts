import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { HEALTH } from './retention-rules';
import { CustomerRetentionService } from './customer-retention.service';

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsIn(HEALTH)
  classification?: (typeof HEALTH)[number];
}

class PolicyDto {
  @IsInt()
  @Min(1)
  @Max(365)
  inactivityDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  unansweredDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  stalledProposalDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  unresolvedConversationDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  followUpDueDays!: number;
}

class StatusDto {
  @IsIn(['acknowledged', 'dismissed', 'completed'])
  status!: 'acknowledged' | 'dismissed' | 'completed';
}

class FollowUpDto {
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

class PlanDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  issue!: string;

  @IsIn(['low', 'medium', 'high'])
  priority!: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsString()
  @MaxLength(800)
  evidence!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  expectedOutcome!: string;

  @IsOptional()
  @IsUUID()
  recommendationId?: string;
}

class OutcomeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  actualOutcome!: string;
}

class FeedbackDto {
  @IsIn(['explicit_positive', 'explicit_negative', 'explicit_concern', 'not_feedback'])
  polarity!: 'explicit_positive' | 'explicit_negative' | 'explicit_concern' | 'not_feedback';
}

@Controller('customer-retention')
@UseGuards(JwtAuthGuard)
export class CustomerRetentionController {
  constructor(private readonly retention: CustomerRetentionService) {}

  @Get('policy')
  policy(@Req() req: Request) {
    return this.retention.getPolicy(this.actor(req).tenantId);
  }

  @Patch('policy')
  savePolicy(@Req() req: Request, @Body() dto: PolicyDto) {
    return this.retention.savePolicy(this.actor(req), dto);
  }

  @Post('refresh')
  refresh(@Req() req: Request) {
    return this.retention.refresh(this.actor(req));
  }

  @Get('analytics')
  analytics(@Req() req: Request) {
    return this.retention.analytics(this.actor(req).tenantId);
  }

  @Get('accounts')
  accounts(@Req() req: Request, @Query() query: PageQuery) {
    return this.retention.list(this.actor(req).tenantId, query.classification, query.page, query.limit);
  }

  @Get('accounts/:companyId')
  account(@Req() req: Request, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.retention.detail(this.actor(req).tenantId, companyId);
  }

  @Post('accounts/:companyId/draft')
  draft(@Req() req: Request, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.retention.draft(this.actor(req), companyId);
  }

  @Get('recommendations')
  recommendations(@Req() req: Request) {
    return this.retention.listRecommendations(this.actor(req).tenantId);
  }

  @Patch('recommendations/:id')
  updateRecommendation(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.retention.setRecommendationStatus(this.actor(req), id, dto.status);
  }

  @Post('recommendations/:id/task')
  createTask(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FollowUpDto) {
    return this.retention.createFollowUp(this.actor(req), id, dto.assignedUserId);
  }

  @Get('plans')
  plans(@Req() req: Request) {
    return this.retention.listPlans(this.actor(req).tenantId);
  }

  @Post('plans')
  createPlan(@Req() req: Request, @Body() dto: PlanDto) {
    return this.retention.createPlan(this.actor(req), dto);
  }

  @Patch('plans/:id/complete')
  completePlan(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OutcomeDto) {
    return this.retention.completePlan(this.actor(req), id, dto.actualOutcome);
  }

  @Patch('feedback/:id')
  correctFeedback(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackDto) {
    return this.retention.correctFeedback(this.actor(req), id, dto.polarity);
  }

  private actor(req: Request) {
    const user = req.user as AuthenticatedUser;
    return { tenantId: user.tenantId, userId: user.userId, role: user.role };
  }
}
