import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { TaskRepository } from '../task.repository.js';

@Injectable()
export class UpdateTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
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
  }
}
