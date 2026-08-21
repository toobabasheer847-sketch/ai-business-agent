import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { UserRepository } from '../../../../modules/user/user.repository';
import { resolveAssignedToForTenant } from '../resolve-assigned-to.js';
import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class CreateTaskTool extends FunctionTool<any> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
  ) {
    super({
      name: 'create_task',
      description:
        'Create a task for the authenticated user. Tenant and owner come from the request context.',
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
  }
}
