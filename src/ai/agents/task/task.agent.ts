import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { UserRepository } from '../../../modules/user/user.repository';
import { resolveAssignedToForTenant } from './resolve-assigned-to.js';
import { getTrustedTaskContext } from './task-request-context.js';
import { TaskRepository } from './task.repository.js';

@Injectable()
export class TaskAgent {
  private readonly agent: any | null;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
  ) {
    const modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.0-flash',
    );
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    if (!apiKey) {
      this.agent = null;
      return;
    }

    const { FunctionTool } = require('@google/adk');

    const createTaskTool = new FunctionTool({
      name: 'create_task',
      description:
        'Create a task for the authenticated user. Tenant and owner are taken from the request, not from arguments.',
      parameters: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignedTo: z.string().optional(),
        dueAt: z.string().optional(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        const assignedTo = await resolveAssignedToForTenant(
          this.userRepository,
          input.assignedTo,
          context.tenantId,
        );
        return this.taskRepository.createTask({
          tenantId: context.tenantId,
          createdBy: context.userId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assignedTo,
          dueAt: input.dueAt,
        });
      },
    });

    const getTaskTool = new FunctionTool({
      name: 'get_task',
      description: 'Fetch a task owned by or assigned to the authenticated user.',
      parameters: z.object({
        taskId: z.string(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        return this.taskRepository.getTask(
          input.taskId,
          context.tenantId,
          context.userId,
        );
      },
    });

    const listTasksTool = new FunctionTool({
      name: 'list_tasks',
      description:
        'List tasks owned by or assigned to the authenticated user.',
      parameters: z.object({
        status: z
          .enum(['pending', 'in_progress', 'completed', 'cancelled'])
          .optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        search: z.string().optional(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        return this.taskRepository.listTasks(
          context.tenantId,
          context.userId,
          input,
        );
      },
    });

    const updateTaskTool = new FunctionTool({
      name: 'update_task',
      description:
        'Update a task owned by or assigned to the authenticated user.',
      parameters: z.object({
        taskId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z
          .enum(['pending', 'in_progress', 'completed', 'cancelled'])
          .optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignedTo: z.string().optional(),
        dueAt: z.string().optional(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        const { taskId, assignedTo, ...patch } = input;
        if (assignedTo !== undefined) {
          patch.assignedTo = await resolveAssignedToForTenant(
            this.userRepository,
            assignedTo,
            context.tenantId,
          );
        }
        return this.taskRepository.updateTask(
          taskId,
          context.tenantId,
          context.userId,
          patch,
        );
      },
    });

    const completeTaskTool = new FunctionTool({
      name: 'complete_task',
      description:
        'Mark a task owned by or assigned to the authenticated user as completed.',
      parameters: z.object({
        taskId: z.string(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        return this.taskRepository.updateTask(
          input.taskId,
          context.tenantId,
          context.userId,
          {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        );
      },
    });

    const cancelTaskTool = new FunctionTool({
      name: 'cancel_task',
      description:
        'Cancel a task owned by or assigned to the authenticated user.',
      parameters: z.object({
        taskId: z.string(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        return this.taskRepository.updateTask(
          input.taskId,
          context.tenantId,
          context.userId,
          {
            status: 'cancelled',
          },
        );
      },
    });

    this.agent = this.createAgent(modelName, apiKey, [
      createTaskTool,
      getTaskTool,
      listTasksTool,
      updateTaskTool,
      completeTaskTool,
      cancelTaskTool,
    ]);
  }

  private createAgent(modelName: string, apiKey: string, tools: any[]) {
    const { LlmAgent, Gemini } = require('@google/adk');

    return new LlmAgent({
      name: 'task_agent',
      model: new Gemini({
        model: modelName,
        apiKey,
      }),
      instruction:
        'You are a tenant-aware task assistant. Use the provided tools to create, read, list, update, complete, and cancel tasks. Never cross tenant boundaries. If the request is ambiguous, ask for clarification. Never accept tenantId or createdBy from the user or tool arguments.',
      tools,
    });
  }

  getAgentInstance() {
    return this.agent;
  }
}
