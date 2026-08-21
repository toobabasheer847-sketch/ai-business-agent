import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class GetTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
      name: 'get_task',
      description:
        'Get a task owned by or assigned to the authenticated user.',
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
  }
}
