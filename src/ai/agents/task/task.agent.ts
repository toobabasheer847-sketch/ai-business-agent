import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { TaskRepository } from './task.repository.js';
import { TaskAgentResponse, TaskContext } from './types/task.types.js';

@Injectable()
export class TaskAgent {
  private readonly agent: any | null;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly configService: ConfigService,
  ) {
    const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    if (!apiKey) {
      this.agent = null;
      return;
    }

    const { FunctionTool } = require('@google/adk');

    const createTaskTool = new FunctionTool({
      name: 'create_task',
      description: 'Create a tenant-scoped task for the current user.',
      parameters: z.object({
        tenantId: z.string(),
        createdBy: z.string(),
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignedTo: z.string().optional(),
        dueAt: z.string().optional(),
      }),
      execute: async (input: any) => this.taskRepository.createTask(input),
    });

    const getTaskTool = new FunctionTool({
      name: 'get_task',
      description: 'Fetch a tenant-scoped task by id.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) => this.taskRepository.getTask(input.taskId, input.tenantId),
    });

    const listTasksTool = new FunctionTool({
      name: 'list_tasks',
      description: 'List tenant-scoped tasks with optional filters.',
      parameters: z.object({
        tenantId: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        search: z.string().optional(),
      }),
      execute: async (input: any) => this.taskRepository.listTasks(input.tenantId, input),
    });

    const updateTaskTool = new FunctionTool({
      name: 'update_task',
      description: 'Update a tenant-scoped task.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignedTo: z.string().optional(),
        dueAt: z.string().optional(),
      }),
      execute: async (input: any) => this.taskRepository.updateTask(input.taskId, input.tenantId, input),
    });

    const completeTaskTool = new FunctionTool({
      name: 'complete_task',
      description: 'Mark a tenant-scoped task as completed.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) => this.taskRepository.updateTask(input.taskId, input.tenantId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      }),
    });

    const cancelTaskTool = new FunctionTool({
      name: 'cancel_task',
      description: 'Cancel a tenant-scoped task.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) => this.taskRepository.updateTask(input.taskId, input.tenantId, {
        status: 'cancelled',
      }),
    });

    this.agent = this.createAgent(modelName, apiKey, [createTaskTool, getTaskTool, listTasksTool, updateTaskTool, completeTaskTool, cancelTaskTool]);
  }

  private createAgent(modelName: string, apiKey: string, tools: any[]) {
    const { LlmAgent, Gemini } = require('@google/adk');

    return new LlmAgent({
      name: 'task_agent',
      model: new Gemini({
        model: modelName,
        apiKey,
      }),
      instruction: 'You are a tenant-aware task assistant. Use the provided tools to create, read, list, update, complete, and cancel tasks. Never cross tenant boundaries. If the request is ambiguous, ask for clarification.',
      tools,
    });
  }

  async processRequest(context: TaskContext, request: string): Promise<TaskAgentResponse> {
    const fallback = this.parseNaturalLanguage(request, context);

    if (fallback.action === 'create') {
      const created = await this.taskRepository.createTask({
        tenantId: context.tenantId,
        createdBy: context.userId,
        title: fallback.data.title,
        description: fallback.data.description,
        priority: fallback.data.priority,
        assignedTo: fallback.data.assignedTo,
        dueAt: fallback.data.dueAt,
      });
      return { action: 'create', data: created, message: 'Task created successfully.' };
    }

    if (fallback.action === 'list') {
      const rows = await this.taskRepository.listTasks(context.tenantId, { status: fallback.data.status });
      return { action: 'list', data: rows, message: 'Tasks retrieved.' };
    }

    if (fallback.action === 'complete') {
      const updated = await this.taskRepository.updateTask(fallback.data.id, context.tenantId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      return { action: 'complete', data: updated, message: 'Task completed.' };
    }

    if (fallback.action === 'cancel') {
      const updated = await this.taskRepository.updateTask(fallback.data.id, context.tenantId, {
        status: 'cancelled',
      });
      return { action: 'cancel', data: updated, message: 'Task cancelled.' };
    }

    return { action: 'get', data: null, message: 'Task request could not be understood.' };
  }

  private parseNaturalLanguage(request: string, context: TaskContext): any {
    const lower = request.toLowerCase();

    if (lower.includes('show') || lower.includes('list') || lower.includes('pending') || lower.includes('today')) {
      return {
        action: 'list',
        data: {
          status: lower.includes('completed') ? 'completed' : lower.includes('cancelled') ? 'cancelled' : 'pending',
        },
      };
    }

    if (lower.includes('complete') || lower.includes('mark as completed')) {
      const id = this.extractId(request);
      return { action: 'complete', data: { id } };
    }

    if (lower.includes('cancel')) {
      const id = this.extractId(request);
      return { action: 'cancel', data: { id } };
    }

    if (lower.includes('create') || lower.includes('new')) {
      const title = request.replace(/^(create|new)\s+/i, '').trim();
      const priority = lower.includes('urgent') ? 'urgent' : lower.includes('high') ? 'high' : lower.includes('low') ? 'low' : 'medium';
      return {
        action: 'create',
        data: {
          title: title || 'Untitled task',
          description: request,
          priority,
          assignedTo: undefined,
          dueAt: undefined,
        },
      };
    }

    return { action: 'get', data: { id: this.extractId(request) } };
  }

  private extractId(request: string): string | undefined {
    const match = request.match(/([a-f0-9-]{8,})/i);
    return match ? match[1] : undefined;
  }
}
