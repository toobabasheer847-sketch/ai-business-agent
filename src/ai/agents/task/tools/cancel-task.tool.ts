import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { TaskRepository } from '../task.repository.js';

@Injectable()
export class CancelTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
      name: 'cancel_task',
      description: 'Cancel a tenant-scoped task.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) =>
        this.taskRepository.updateTask(input.taskId, input.tenantId, {
          status: 'cancelled',
        }),
    });
  }
}
