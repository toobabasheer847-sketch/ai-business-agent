import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class CancelTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
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
  }
}
