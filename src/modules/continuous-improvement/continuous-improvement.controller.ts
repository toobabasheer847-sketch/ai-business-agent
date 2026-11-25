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
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import type { PlanStatus } from '../strategic-decisions/strategic-decision';
import { ContinuousImprovementService } from './continuous-improvement.service';

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
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsUUID()
  recommendationId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'custom'])
  reviewSchedule?: 'weekly' | 'monthly' | 'custom';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  milestones?: string[];

  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;
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
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'custom'])
  reviewSchedule?: 'weekly' | 'monthly' | 'custom';
}

class ReviewDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;
}

class CompleteReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(800)
  decision?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('continuous-improvement')
export class ContinuousImprovementController {
  constructor(private readonly improvement: ContinuousImprovementService) {}

  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.improvement.overview(this.actor(request));
  }

  @Get('deviations')
  deviations(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('metricKey') metricKey?: string,
    @Query('deviationType') deviationType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = boundedRange(from, to);
    return this.improvement.deviations(this.actor(request), {
      page: pageOf(page),
      limit: limitOf(limit),
      metricKey,
      deviationType,
      from: range?.from,
      to: range?.to,
    });
  }

  @Get('bottlenecks')
  bottlenecks(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.improvement.bottleneckList(this.actor(request), {
      page: pageOf(page),
      limit: limitOf(limit),
      status,
      category,
    });
  }

  @Post('bottlenecks/:id/review')
  reviewBottleneck(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.reviewBottleneck(this.actor(request), id);
  }

  @Post('bottlenecks/:id/resolve')
  resolveBottleneck(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.resolveBottleneck(this.actor(request), id);
  }

  @Get('recommendations')
  recommendations(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.improvement.recommendationList(this.actor(request), pageOf(page), limitOf(limit), status);
  }

  @Get('recommendations/:id')
  recommendation(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.recommendation(this.actor(request), id);
  }

  @Post('recommendations/refresh')
  refresh(@Req() request: AuthenticatedRequest) {
    return this.improvement.refresh(this.actor(request));
  }

  @Post('recommendations/:id/feedback')
  feedback(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: FeedbackDto) {
    return this.improvement.feedback(this.actor(request), id, body.feedbackType, body.reason);
  }

  @Post('recommendations/:id/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.decide(this.actor(request), id, 'accepted');
  }

  @Post('recommendations/:id/reject')
  reject(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.decide(this.actor(request), id, 'rejected');
  }

  @Get('plans')
  plans(@Req() request: AuthenticatedRequest) {
    return this.improvement.plans(this.actor(request));
  }

  @Post('plans')
  createPlan(@Req() request: AuthenticatedRequest, @Body() body: PlanDto) {
    return this.improvement.createPlan(this.actor(request), body);
  }

  @Get('plans/:id')
  plan(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.plan(this.actor(request), id);
  }

  @Patch('plans/:id')
  updatePlan(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePlanDto) {
    return this.improvement.updatePlan(this.actor(request), id, body);
  }

  @Post('plans/:id/submit')
  submit(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.movePlan(this.actor(request), id, 'REVIEW_REQUIRED');
  }

  @Post('plans/:id/approve')
  approve(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.movePlan(this.actor(request), id, 'APPROVED' as PlanStatus);
  }

  @Post('plans/:id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.movePlan(this.actor(request), id, 'ACTIVE');
  }

  @Post('plans/:id/hold')
  hold(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.movePlan(this.actor(request), id, 'ON_HOLD');
  }

  @Post('plans/:id/complete')
  complete(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.movePlan(this.actor(request), id, 'COMPLETED');
  }

  @Post('plans/:id/milestones/:milestoneId/complete')
  completeMilestone(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.improvement.completeMilestone(this.actor(request), id, milestoneId);
  }

  @Get('outcomes')
  outcomes(@Req() request: AuthenticatedRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.improvement.outcomeList(this.actor(request), pageOf(page), limitOf(limit));
  }

  @Post('outcomes/evaluate')
  evaluate(@Req() request: AuthenticatedRequest) {
    return this.improvement.evaluate(this.actor(request));
  }

  @Get('outcomes/:id')
  outcome(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.outcome(this.actor(request), id);
  }

  @Get('reviews')
  reviews(@Req() request: AuthenticatedRequest) {
    return this.improvement.reviews(this.actor(request));
  }

  @Post('reviews')
  createReview(@Req() request: AuthenticatedRequest, @Body() body: ReviewDto) {
    return this.improvement.createReview(this.actor(request), body);
  }

  @Get('reviews/:id')
  review(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.improvement.review(this.actor(request), id);
  }

  @Post('reviews/:id/complete')
  completeReview(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: CompleteReviewDto) {
    return this.improvement.completeReview(this.actor(request), id, body.decision);
  }

  @Get('history')
  history(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('eventType') eventType?: string,
    @Query('relatedEntityType') relatedEntityType?: string,
    @Query('relatedEntityId') relatedEntityId?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = boundedRange(from, to);
    return this.improvement.historyList(this.actor(request), {
      page: pageOf(page),
      limit: limitOf(limit),
      eventType,
      relatedEntityType,
      relatedEntityId,
      actorId,
      from: range?.from,
      to: range?.to,
    });
  }

  private actor(request: AuthenticatedRequest) {
    return { tenantId: request.user.tenantId, userId: request.user.userId, role: request.user.role };
  }
}

function pageOf(value?: string) {
  const page = Number(value ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new BadRequestException('Page is out of range.');
  return page;
}

function limitOf(value?: string) {
  const limit = Number(value ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('Limit is out of range.');
  return limit;
}

function boundedRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new BadRequestException('The date range is invalid.');
  }
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('The date range cannot exceed 366 days.');
  }
  return { from: start, to: end };
}
