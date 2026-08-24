import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { UserRepository } from '../../../../modules/user/user.repository';
import { resolveAssignedToForTenant } from '../resolve-assigned-to.js';
import { TaskCrmResolver } from '../resolve-crm-entities.js';
import { getTrustedTaskContext } from '../task-request-context.js';
import { TaskRepository } from '../task.repository.js';

@Injectable()
export class CreateTaskTool extends FunctionTool<any> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
    private readonly crmResolver: TaskCrmResolver,
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
        companyId: z.string().uuid().optional(),
        prospectId: z.string().uuid().optional(),
        leadId: z.string().uuid().optional(),
        dueAt: z.string().optional(),
      }),
      execute: async (input: any) => {
        const context = getTrustedTaskContext();
        const assignedTo = await resolveAssignedToForTenant(
          this.userRepository,
          input.assignedTo,
          context.tenantId,
        );
        const crmIds = await this.crmResolver.assertIds(context.tenantId, {
          companyId: input.companyId,
          prospectId: input.prospectId,
          leadId: input.leadId,
        });
        return this.taskRepository.createTask({
          tenantId: context.tenantId,
          createdBy: context.userId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assignedTo,
          dueAt: input.dueAt,
          companyId: crmIds.companyId ?? null,
          prospectId: crmIds.prospectId ?? null,
          leadId: crmIds.leadId ?? null,
        });
      },
    });
  }
}
