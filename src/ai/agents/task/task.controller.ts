import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { ProcessNaturalLanguageDto } from './dto/process-natural-language.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskService } from './task.service.js';

@Controller('ai/task')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.taskService.createTask(dto, context);
  }

  @Get()
  async list(@Query() dto: TaskQueryDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.taskService.listTasks(dto, context);
  }

  @Post('natural-language')
  async handleNaturalLanguage(
    @Body() dto: ProcessNaturalLanguageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.processNaturalLanguage(dto.message, context);
  }

  @Get(':taskId')
  async get(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getTask(taskId, context);
  }

  @Post(':taskId')
  async update(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.updateTask(taskId, dto, context);
  }

  @Post(':taskId/complete')
  async complete(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.completeTask(taskId, context);
  }

  @Post(':taskId/cancel')
  async cancel(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.cancelTask(taskId, context);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.deleteTask(taskId, context);
  }

  private buildContext(req: AuthenticatedRequest) {
    const user = req.user;

    if (!user?.tenantId || !user?.userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
    };
  }
}
