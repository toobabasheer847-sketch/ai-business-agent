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
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { WorkflowService } from './workflow.service';

class CreateWorkflowDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  definition!: Record<string, unknown>;
}

class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}

class GenerateWorkflowDto {
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  instruction!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get('summary')
  summary(@Req() request: AuthenticatedRequest) {
    return this.workflows.summary(request.user.tenantId);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.workflows.list(request.user.tenantId, {
      page,
      limit,
      search,
      status,
    });
  }

  @Post('generate')
  generate(
    @Req() request: AuthenticatedRequest,
    @Body() dto: GenerateWorkflowDto,
  ) {
    return this.workflows.generate(request.user, dto.instruction);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(request.user, dto);
  }

  @Get(':id/executions')
  executions(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workflows.executions(request.user.tenantId, id, {
      page,
      limit,
    });
  }

  @Get(':id')
  find(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.detail(request.user.tenantId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.update(request.user, id, dto);
  }

  @Post(':id/activate')
  activate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.activate(request.user, id);
  }

  @Post(':id/pause')
  pause(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.pause(request.user, id);
  }

  @Post(':id/resume')
  resume(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.resume(request.user, id);
  }

  @Post(':id/execute')
  execute(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.execute(request.user, id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('workflow-executions')
export class WorkflowExecutionController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get(':id')
  find(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.execution(request.user.tenantId, id);
  }

  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.cancel(request.user, id);
  }
}
