import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { TaskRepository } from '../task.repository.js';

@Injectable()
export class CreateTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
      name: 'create_task',
      description: 'Create a tenant-scoped task.',
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
  }
}
