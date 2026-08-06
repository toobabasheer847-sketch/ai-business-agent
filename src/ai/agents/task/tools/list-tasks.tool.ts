import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { TaskRepository } from '../task.repository.js';

@Injectable()
export class ListTasksTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
      name: 'list_tasks',
      description: 'List tenant-scoped tasks.',
      parameters: z.object({
        tenantId: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        search: z.string().optional(),
      }),
      execute: async (input: any) => this.taskRepository.listTasks(input.tenantId, input),
    });
  }
}
