import {
  BadRequestException,
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
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { StrategicDecisionService } from './strategic-decision.service';

class FeedbackDto {
  @IsIn(['useful', 'not_useful', 'unclear'])
  feedbackType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

class PlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(400)
  objective!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;

  @IsString()
  @MaxLength(40)
  category!: string;

  @IsString()
  metricKey!: string;

  @IsNumber()
  targetValue!: number;

  @IsISO8601()
  targetDate!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsISO8601()
  targetDate?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

class MilestoneDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

class ActionPlanDto {
  @IsString()
  recommendationId!: string;

  @IsOptional()
  @IsString()
  planId?: string;
}

class GoalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(800)
  description!: string;

  @IsString()
  metricKey!: string;

  @IsNumber()
  targetValue!: number;

  @IsISO8601()
  targetDate!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsISO8601()
  targetDate?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('strategic-decisions')
export class StrategicDecisionController {
  constructor(private readonly decisions: StrategicDecisionService) {}

  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.decisions.overview(request.user.tenantId);
  }

  @Get('recommendations')
  recommendations(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.decisions.recommendations(
      request.user.tenantId,
      pageNumber(page, 1),
      pageNumber(limit, 20, 50),
      knownStatus(status),
    );
  }

  @Post('recommendations/refresh')
  refresh(@Req() request: AuthenticatedRequest) {
    return this.decisions.refresh(request.user.tenantId);
  }

  @Get('recommendations/:id')
  recommendation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.recommendation(request.user.tenantId, id);
  }

  @Post('recommendations/:id/feedback')
  feedback(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FeedbackDto,
  ) {
    return this.decisions.feedback(
      actor(request),
      id,
      body.feedbackType,
      body.reason,
    );
  }

  @Post('recommendations/:id/accept')
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.decide(actor(request), id, 'accepted');
  }

  @Post('recommendations/:id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.decide(actor(request), id, 'rejected');
  }

  @Get('plans')
  plans(@Req() request: AuthenticatedRequest) {
    return this.decisions.plans(request.user.tenantId);
  }

  @Post('plans')
  createPlan(@Req() request: AuthenticatedRequest, @Body() body: PlanDto) {
    return this.decisions.createPlan(actor(request), body);
  }

  @Get('plans/:id')
  plan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.plan(request.user.tenantId, id);
  }

  @Patch('plans/:id')
  updatePlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePlanDto,
  ) {
    return this.decisions.updatePlan(actor(request), id, body);
  }

  @Post('plans/:id/activate')
  activatePlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.movePlan(actor(request), id, 'ACTIVE');
  }

  @Post('plans/:id/hold')
  holdPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.movePlan(actor(request), id, 'ON_HOLD');
  }

  @Post('plans/:id/complete')
  completePlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.movePlan(actor(request), id, 'COMPLETED');
  }

  @Post('plans/:id/cancel')
  cancelPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.movePlan(actor(request), id, 'CANCELLED');
  }

  @Post('plans/:id/milestones')
  addMilestone(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MilestoneDto,
  ) {
    return this.decisions.addMilestone(
      actor(request),
      id,
      body.title,
      body.description ?? '',
    );
  }

  @Post('plans/:id/milestones/:milestoneId/complete')
  completeMilestone(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.decisions.completeMilestone(actor(request), id, milestoneId);
  }

  @Get('action-plans')
  actionPlans(@Req() request: AuthenticatedRequest) {
    return this.decisions.actionPlans(request.user.tenantId);
  }

  @Post('action-plans')
  createActionPlan(
    @Req() request: AuthenticatedRequest,
    @Body() body: ActionPlanDto,
  ) {
    return this.decisions.createActionPlan(
      actor(request),
      body.recommendationId,
      body.planId,
    );
  }

  @Get('action-plans/:id')
  actionPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.actionPlan(request.user.tenantId, id);
  }

  @Post('action-plans/:id/execute')
  executeActionPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.executeActionPlan(actor(request), id);
  }

  @Post('action-plans/:id/cancel')
  cancelActionPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.cancelActionPlan(actor(request), id);
  }

  @Post('action-plans/:id/steps/:stepId/complete')
  completeStep(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.decisions.completeStep(actor(request), id, stepId);
  }

  @Get('goals')
  goals(@Req() request: AuthenticatedRequest) {
    return this.decisions.goals(request.user.tenantId);
  }

  @Post('goals')
  createGoal(@Req() request: AuthenticatedRequest, @Body() body: GoalDto) {
    return this.decisions.createGoal(actor(request), body);
  }

  @Get('goals/:id/history')
  goalHistory(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.goalHistory(request.user.tenantId, id);
  }

  @Get('goals/:id')
  goal(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decisions.goal(request.user.tenantId, id);
  }

  @Patch('goals/:id')
  updateGoal(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGoalDto,
  ) {
    return this.decisions.updateGoal(actor(request), id, body);
  }
}

function actor(request: AuthenticatedRequest) {
  return {
    tenantId: request.user.tenantId,
    userId: request.user.userId,
    role: request.user.role,
  };
}

function pageNumber(value: string | undefined, fallback: number, max = 1000) {
  if (value === undefined || value === '') return Math.min(fallback, max);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(
      'Page and limit must be positive integers inside the allowed range.',
    );
  }
  return parsed;
}

function knownStatus(value?: string) {
  if (!value) return undefined;
  if (!['open', 'accepted', 'rejected', 'expired'].includes(value)) {
    throw new BadRequestException('Unknown recommendation status.');
  }
  return value;
}
