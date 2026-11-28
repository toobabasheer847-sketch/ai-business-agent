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
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  type OpportunityStatus,
} from './growth-rules';
import { RevenueGrowthService } from './revenue-growth.service';

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
  @IsIn(OPPORTUNITY_TYPES)
  type?: (typeof OPPORTUNITY_TYPES)[number];

  @IsOptional()
  @IsIn(OPPORTUNITY_STATUSES)
  status?: OpportunityStatus;

  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';
}

class PolicyDto {
  @IsInt()
  @Min(1)
  @Max(365)
  leadQuietDays!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  proposalFollowUpDays!: number;
}

class StatusDto {
  @IsIn(OPPORTUNITY_STATUSES)
  status!: OpportunityStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  outcome?: string;
}

class AssignDto {
  @IsUUID()
  assignedUserId!: string;
}

class PriorityDto {
  @IsIn(['high', 'medium', 'low'])
  priority!: 'high' | 'medium' | 'low';
}

class TaskDto {
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

class PlanDto {
  @IsUUID()
  opportunityId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  expectedOutcome!: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

class PlanUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  expectedOutcome?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

class OutcomeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  actualOutcome!: string;
}

@Controller('growth-opportunities')
@UseGuards(JwtAuthGuard)
export class RevenueGrowthController {
  constructor(private readonly growth: RevenueGrowthService) {}

  @Get('policy')
  policy(@Req() req: Request) {
    return this.growth.getPolicy(this.actor(req).tenantId);
  }

  @Patch('policy')
  savePolicy(@Req() req: Request, @Body() dto: PolicyDto) {
    return this.growth.savePolicy(this.actor(req), dto);
  }

  @Post('refresh')
  refresh(@Req() req: Request) {
    return this.growth.refresh(this.actor(req));
  }

  @Get('analytics')
  analytics(@Req() req: Request) {
    return this.growth.analytics(this.actor(req).tenantId);
  }

  @Get('plans')
  plans(@Req() req: Request) {
    return this.growth.listPlans(this.actor(req).tenantId);
  }

  @Post('plans')
  createPlan(@Req() req: Request, @Body() dto: PlanDto) {
    return this.growth.createPlan(this.actor(req), dto);
  }

  @Patch('plans/:id')
  updatePlan(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanUpdateDto,
  ) {
    return this.growth.updatePlan(this.actor(req), id, dto);
  }

  @Patch('plans/:id/complete')
  completePlan(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OutcomeDto,
  ) {
    return this.growth.completePlan(this.actor(req), id, dto.actualOutcome);
  }

  @Get()
  list(@Req() req: Request, @Query() query: PageQuery) {
    return this.growth.list(this.actor(req).tenantId, query);
  }

  @Get(':id/history')
  history(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.growth.history(this.actor(req).tenantId, id);
  }

  @Get(':id')
  detail(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.growth.detail(this.actor(req).tenantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.growth.updateStatus(
      this.actor(req),
      id,
      dto.status,
      dto.outcome,
    );
  }

  @Patch(':id/assign')
  assign(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDto,
  ) {
    return this.growth.assign(this.actor(req), id, dto.assignedUserId);
  }

  @Patch(':id/priority')
  prioritize(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PriorityDto,
  ) {
    return this.growth.prioritize(this.actor(req), id, dto.priority);
  }

  @Post(':id/draft')
  draft(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.growth.draft(this.actor(req), id);
  }

  @Post(':id/task')
  createTask(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskDto,
  ) {
    return this.growth.createTask(this.actor(req), id, dto.assignedUserId);
  }

  private actor(req: Request) {
    const user = req.user;
    return { tenantId: user.tenantId, userId: user.userId, role: user.role };
  }
}
