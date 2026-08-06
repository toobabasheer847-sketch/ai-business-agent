import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../../../common/guards/auth.guard.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskService } from './task.service.js';

@Controller('api/ai/task')
@UseGuards(AuthGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.createTask(dto, context);
  }

  @Get() 
  async list(@Query() dto: TaskQueryDto, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.listTasks(dto, context);
  }

  @Get(':taskId')
  async get(@Param('taskId') taskId: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.getTask(taskId, context);
  }

  @Post(':taskId')
  async update(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.updateTask(taskId, dto, context);
  }

  @Post(':taskId/complete')
  async complete(@Param('taskId') taskId: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.completeTask(taskId, context);
  }

  @Post(':taskId/cancel')
  async cancel(@Param('taskId') taskId: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.cancelTask(taskId, context);
  }

  @Post('natural-language')
  async handleNaturalLanguage(@Body('message') message: string, @Req() req: Request) {
    const context = this.buildContext(req);
    return this.taskService.processNaturalLanguage(message, context);
  }

  private buildContext(req: Request) {
    const user = (req as Request & { user?: { id?: string; tenantId?: string; email?: string } }).user;
    return {
      userId: user?.id ?? '',
      tenantId: user?.tenantId ?? '',
      email: user?.email,
    };
  }
}
