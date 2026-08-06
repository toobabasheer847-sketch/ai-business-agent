import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { TaskRepository } from '../task.repository.js';

@Injectable()
export class GetTaskTool extends FunctionTool<any> {
  constructor(private readonly taskRepository: TaskRepository) {
    super({
      name: 'get_task',
      description: 'Get a tenant-scoped task by id.',
      parameters: z.object({
        taskId: z.string(),
        tenantId: z.string(),
      }),
      execute: async (input: any) =>
        this.taskRepository.getTask(input.taskId, input.tenantId),
    });
  }
}
