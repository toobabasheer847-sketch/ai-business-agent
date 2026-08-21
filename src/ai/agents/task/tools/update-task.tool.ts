import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { UserRepository } from '../../../../modules/user/user.repository';
import { resolveAssignedToForTenant } from '../resolve-assigned-to.js';
import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class UpdateTaskTool extends FunctionTool<any> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
  ) {
    super({
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
        const { taskId, ...patch } = input;
        if (patch.assignedTo !== undefined) {
          patch.assignedTo = await resolveAssignedToForTenant(
            this.userRepository,
            patch.assignedTo,
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
  }
}
