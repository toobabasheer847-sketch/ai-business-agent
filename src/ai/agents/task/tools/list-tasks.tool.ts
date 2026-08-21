import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class ListTasksTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
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
  }
}
