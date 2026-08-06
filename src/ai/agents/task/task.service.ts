import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TaskAgent } from './task.agent.js';
import { TaskRepository } from './task.repository.js';
import { TaskContext, TaskRecord } from './types/task.types.js';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskAgent: TaskAgent,
    private readonly taskRepository: TaskRepository,
  ) {}

  async createTask(dto: CreateTaskDto, context: TaskContext): Promise<TaskRecord> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    if (!context?.userId) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    try {
      return await this.taskRepository.createTask({
        tenantId: context.tenantId,
        createdBy: context.userId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as any,
        assignedTo: dto.assignedTo ?? null,
        dueAt: dto.dueAt ?? null,
      });
    } catch (error) {
      this.handleError(error, 'create task');
      throw new InternalServerErrorException('Failed to create task');
    }
  }

  async getTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const task = await this.taskRepository.getTask(taskId, context.tenantId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access tasks for another tenant');
    }

    return task;
  }

  async listTasks(dto: TaskQueryDto, context: TaskContext): Promise<TaskRecord[]> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.taskRepository.listTasks(context.tenantId, {
      status: dto.status as any,
      priority: dto.priority as any,
      search: dto.search,
    });
  }

  async updateTask(taskId: string, dto: UpdateTaskDto, context: TaskContext): Promise<TaskRecord> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const existing = await this.taskRepository.getTask(taskId, context.tenantId);
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (existing.tenantId !== context.tenantId) {
      throw new ForbiddenException('You cannot access tasks for another tenant');
    }

    const updated = await this.taskRepository.updateTask(taskId, context.tenantId, {
      title: dto.title,
      description: dto.description,
      status: dto.status as any,
      priority: dto.priority as any,
      assignedTo: dto.assignedTo,
      dueAt: dto.dueAt,
    });

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async completeTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const updated = await this.taskRepository.updateTask(taskId, context.tenantId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async cancelTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const updated = await this.taskRepository.updateTask(taskId, context.tenantId, {
      status: 'cancelled',
    });

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async processNaturalLanguage(request: string, context: TaskContext): Promise<any> {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.taskAgent.processRequest(context, request);
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException || error instanceof ForbiddenException) {
      throw error;
    }

    console.error(`TaskService.${operation} failed`, error);
    throw new InternalServerErrorException(`Failed to ${operation}`);
  }
}
