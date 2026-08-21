import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { UserRepository } from '../../../modules/user/user.repository';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import {
  parseTaskCommand,
  titleMatchesSearch,
  type TaskNlCommand,
} from './parse-task-command.js';
import { isSameUtcDay } from './parse-task-datetime.js';
import { resolveAssignedToForTenant } from './resolve-assigned-to.js';
import { TaskCrmResolver } from './resolve-crm-entities.js';
import { normalizeCrmIds } from './resolve-crm-ids.js';
import { TaskRepository } from './task.repository.js';
import {
  TaskAgentResponse,
  TaskContext,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from './types/task.types.js';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
    private readonly crmResolver: TaskCrmResolver,
  ) {}

  async createTask(
    dto: CreateTaskDto,
    context: TaskContext,
  ): Promise<TaskRecord> {
    this.requireAuthContext(context);
    const assignedTo = await resolveAssignedToForTenant(
      this.userRepository,
      dto.assignedTo,
      context.tenantId,
    );
    const crmIds = await this.crmResolver.assertIds(context.tenantId, {
      companyId: dto.companyId,
      prospectId: dto.prospectId,
      leadId: dto.leadId,
    });

    try {
      return await this.taskRepository.createTask({
        tenantId: context.tenantId,
        createdBy: context.userId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as TaskPriority | undefined,
        assignedTo,
        dueAt: this.parseOptionalDueAt(dto.dueAt),
        companyId: crmIds.companyId ?? null,
        prospectId: crmIds.prospectId ?? null,
        leadId: crmIds.leadId ?? null,
      });
    } catch (error) {
      this.handleError(error, 'create task');
    }
  }

  async getTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    this.requireAuthContext(context);

    const task = await this.taskRepository.findByIdAndTenantAndUser(
      taskId,
      context.tenantId,
      context.userId,
    );

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async listTasks(
    dto: TaskQueryDto,
    context: TaskContext,
  ): Promise<TaskRecord[]> {
    this.requireAuthContext(context);

    return this.taskRepository.findAllByTenantAndUser(
      context.tenantId,
      context.userId,
      {
        status: dto.status as TaskStatus | undefined,
        priority: dto.priority as TaskPriority | undefined,
        search: dto.search,
      },
    );
  }

  async updateTask(
    taskId: string,
    dto: UpdateTaskDto,
    context: TaskContext,
  ): Promise<TaskRecord> {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);

    const assignedTo =
      dto.assignedTo === undefined
        ? undefined
        : await resolveAssignedToForTenant(
            this.userRepository,
            dto.assignedTo,
            context.tenantId,
          );
    const crmIds = await this.crmResolver.assertIds(context.tenantId, {
      companyId: dto.companyId,
      prospectId: dto.prospectId,
      leadId: dto.leadId,
    });

    const updated = await this.taskRepository.updateTask(
      taskId,
      context.tenantId,
      context.userId,
      {
        title: dto.title,
        description: dto.description,
        status: dto.status as TaskStatus | undefined,
        priority: dto.priority as TaskPriority | undefined,
        assignedTo,
        dueAt: this.parseOptionalDueAt(dto.dueAt),
        ...crmPatch(crmIds, dto),
      },
    );

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async completeTask(
    taskId: string,
    context: TaskContext,
  ): Promise<TaskRecord> {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);

    const updated = await this.taskRepository.updateTask(
      taskId,
      context.tenantId,
      context.userId,
      {
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    );

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async cancelTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);

    const updated = await this.taskRepository.updateTask(
      taskId,
      context.tenantId,
      context.userId,
      {
        status: 'cancelled',
      },
    );

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    return updated;
  }

  async deleteTask(
    taskId: string,
    context: TaskContext,
  ): Promise<{ message: string; id: string }> {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);

    const deleted = await this.taskRepository.deleteTask(
      taskId,
      context.tenantId,
      context.userId,
    );

    if (!deleted) {
      throw new NotFoundException('Task not found');
    }

    return {
      message: 'Task deleted successfully',
      id: taskId,
    };
  }

  async processNaturalLanguage(
    request: string,
    context: TaskContext,
    now: Date = new Date(),
  ): Promise<TaskAgentResponse> {
    this.requireAuthContext(context);
    const command = parseTaskCommand(request, { now });
    return this.executeNaturalLanguageCommand(command, context, now);
  }

  private async executeNaturalLanguageCommand(
    command: TaskNlCommand,
    context: TaskContext,
    now: Date,
  ): Promise<TaskAgentResponse> {
    if (command.action === 'clarify') {
      return {
        action: 'clarify',
        data: null,
        message: command.message,
      };
    }

    if (command.action === 'create') {
      const crm = await this.applyCrmToCreate(command, context);
      if (crm.kind === 'clarify') {
        return {
          action: 'clarify',
          data: null,
          message: crm.message,
        };
      }

      const created = await this.createTask(
        {
          title: crm.title,
          description: crm.description,
          priority: command.priority,
          dueAt: command.dueAt,
          companyId: crm.companyId,
          prospectId: crm.prospectId,
          leadId: crm.leadId,
        },
        context,
      );

      return {
        action: 'create',
        data: created,
        message: crm.message || 'Task created successfully.',
      };
    }

    if (command.action === 'list') {
      const rows = await this.listTasks(
        {
          status: command.status,
          priority: command.priority,
        },
        context,
      );
      const data =
        command.dueOn === 'today'
          ? rows.filter((row) => isSameUtcDay(row.dueAt, now))
          : rows;

      return {
        action: 'list',
        data,
        message: 'Tasks retrieved.',
      };
    }

    const resolved = await this.resolveNaturalLanguageTask(command, context);
    if (resolved.kind !== 'found') {
      return resolved.response;
    }

    if (command.action === 'get') {
      return {
        action: 'get',
        data: resolved.task,
        message: 'Task retrieved.',
      };
    }

    if (command.action === 'complete') {
      const updated = await this.completeTask(resolved.task.id, context);
      return {
        action: 'complete',
        data: updated,
        message: 'Task completed.',
      };
    }

    if (command.action === 'cancel') {
      const updated = await this.cancelTask(resolved.task.id, context);
      return {
        action: 'cancel',
        data: updated,
        message: 'Task cancelled.',
      };
    }

    const updated = await this.updateTask(
      resolved.task.id,
      {
        priority: command.priority,
        status: command.status,
      },
      context,
    );

    return {
      action: 'update',
      data: updated,
      message: 'Task updated.',
    };
  }

  private async resolveNaturalLanguageTask(
    command: TaskNlCommand,
    context: TaskContext,
  ): Promise<
    | { kind: 'found'; task: TaskRecord }
    | { kind: 'unresolved'; response: TaskAgentResponse }
  > {
    if (command.taskId) {
      const task = await this.taskRepository.findByIdAndTenantAndUser(
        command.taskId,
        context.tenantId,
        context.userId,
      );

      if (!task) {
        return {
          kind: 'unresolved',
          response: {
            action: command.action,
            data: null,
            message: 'Task not found.',
          },
        };
      }

      return { kind: 'found', task };
    }

    const crm = await this.crmResolver.resolve(
      {
        companyQuery: command.companyQuery,
        personQuery: command.personQuery,
        emailQuery: command.emailQuery,
        explicitCompany: command.explicitCompany === true,
      },
      context.tenantId,
    );

    if (crm.status === 'ambiguous' && command.explicitCompany) {
      return {
        kind: 'unresolved',
        response: {
          action: 'clarify',
          data: null,
          message: this.formatCrmClarify(crm),
        },
      };
    }

    const searchTerm = command.searchTerm?.trim();
    if (!searchTerm) {
      return {
        kind: 'unresolved',
        response: {
          action: 'clarify',
          data: null,
          message: 'Which task do you mean?',
        },
      };
    }

    const matches = (
      await this.taskRepository.findAllByTenantAndUser(
        context.tenantId,
        context.userId,
      )
    ).filter((task) => taskMatchesSearch(task, searchTerm));

    if (matches.length === 0) {
      return {
        kind: 'unresolved',
        response: {
          action: command.action,
          data: null,
          message: 'Task not found.',
        },
      };
    }

    if (matches.length > 1) {
      return {
        kind: 'unresolved',
        response: {
          action: 'clarify',
          data: matches,
          message: `I found ${matches.length} matching tasks. Which one do you mean?`,
        },
      };
    }

    return { kind: 'found', task: matches[0] };
  }

  private async applyCrmToCreate(
    command: TaskNlCommand,
    context: TaskContext,
  ): Promise<
    | {
        kind: 'ok';
        title: string;
        description?: string;
        message: string;
        companyId?: string | null;
        prospectId?: string | null;
        leadId?: string | null;
      }
    | { kind: 'clarify'; message: string }
  > {
    const resolution = await this.crmResolver.resolve(
      {
        companyQuery: command.companyQuery,
        personQuery: command.personQuery,
        emailQuery: command.emailQuery,
        explicitCompany: command.explicitCompany === true,
      },
      context.tenantId,
    );

    if (resolution.status === 'ambiguous') {
      return { kind: 'clarify', message: this.formatCrmClarify(resolution) };
    }

    if (resolution.status === 'missing') {
      return {
        kind: 'clarify',
        message: `I couldn't find a company named ${resolution.query}. Would you like me to create the task without linking it?`,
      };
    }

    let title = command.title!;
    const description = command.description;
    const crmIds = {
      companyId: undefined as string | null | undefined,
      prospectId: undefined as string | null | undefined,
      leadId: undefined as string | null | undefined,
    };

    if (resolution.status === 'resolved') {
      title = applyResolvedCrmNames(title, command, resolution);
      const linked = linksFromResolution(resolution);
      crmIds.companyId = linked.companyId;
      crmIds.prospectId = linked.prospectId;
      crmIds.leadId = linked.leadId;
    }

    return {
      kind: 'ok',
      title,
      description,
      message: this.formatCreateMessage(title, command.dueAt, resolution),
      ...crmIds,
    };
  }

  private formatCrmClarify(resolution: {
    kind: 'company' | 'person';
    query: string;
    matches: string[];
  }): string {
    const label = resolution.kind === 'company' ? 'companies' : 'people';
    const listed = resolution.matches.join(', ');
    return `I found ${resolution.matches.length} ${label} matching ${resolution.query}. Which one do you mean? ${listed}`;
  }

  private formatCreateMessage(
    title: string,
    dueAt: string | undefined,
    resolution: { status: string; company?: { name: string }; person?: { name: string } },
  ): string {
    const due =
      dueAt && !Number.isNaN(new Date(dueAt).getTime())
        ? ` — due ${new Date(dueAt).toISOString().slice(0, 10)}`
        : '';

    if (resolution.status === 'resolved' && resolution.person) {
      return `Task created for ${resolution.person.name}${due}.`;
    }

    if (resolution.status === 'resolved' && resolution.company) {
      return `Task created: ${title}${due}.`;
    }

    return `Task created successfully.${due ? ` ${title}${due}.` : ''}`.trim();
  }

  private async requireAccessibleTask(taskId: string, context: TaskContext) {
    const existing = await this.taskRepository.findByIdAndTenantAndUser(
      taskId,
      context.tenantId,
      context.userId,
    );

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    return existing;
  }

  private parseOptionalDueAt(value?: string | null) {
    if (value === undefined || value === null || value === '') {
      return value === null ? null : undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('dueAt must be a valid date');
    }

    return value;
  }

  private requireAuthContext(context: TaskContext) {
    if (!context?.tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    if (!context?.userId) {
      throw new UnauthorizedException('Authenticated user is required');
    }
  }

  private handleError(error: unknown, operation: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    console.error(`TaskService.${operation} failed`, error);
    throw new InternalServerErrorException(`Failed to ${operation}`);
  }
}

function crmPatch(
  crmIds: ReturnType<typeof normalizeCrmIds>,
  dto: { companyId?: string | null; prospectId?: string | null; leadId?: string | null },
) {
  const patch: {
    companyId?: string | null;
    prospectId?: string | null;
    leadId?: string | null;
  } = {};

  if (dto.companyId !== undefined) {
    patch.companyId = crmIds.companyId ?? null;
  }
  if (dto.prospectId !== undefined) {
    patch.prospectId = crmIds.prospectId ?? null;
  }
  if (dto.leadId !== undefined) {
    patch.leadId = crmIds.leadId ?? null;
  }

  return patch;
}

function linksFromResolution(resolution: {
  company?: { id: string };
  person?: { kind: 'prospect' | 'lead'; id: string; companyId?: string | null };
}) {
  const companyId = resolution.company?.id ?? resolution.person?.companyId ?? null;
  return {
    companyId: companyId || undefined,
    prospectId:
      resolution.person?.kind === 'prospect' ? resolution.person.id : undefined,
    leadId: resolution.person?.kind === 'lead' ? resolution.person.id : undefined,
  };
}

function taskMatchesSearch(task: TaskRecord, searchTerm: string) {
  return (
    titleMatchesSearch(task.title, searchTerm) ||
    titleMatchesSearch(task.company?.name ?? '', searchTerm) ||
    titleMatchesSearch(task.prospect?.name ?? '', searchTerm) ||
    titleMatchesSearch(task.lead?.name ?? '', searchTerm)
  );
}

function applyResolvedCrmNames(
  title: string,
  command: TaskNlCommand,
  resolution: { company?: { name: string }; person?: { name: string } },
): string {
  let next = title;

  if (resolution.company && command.companyQuery) {
    next = replaceWholeQuery(
      next,
      command.companyQuery,
      resolution.company.name,
      true,
    );
  } else if (resolution.company && command.personQuery && !resolution.person) {
    next = replaceWholeQuery(
      next,
      command.personQuery,
      resolution.company.name,
      false,
    );
  }

  if (resolution.person && (command.personQuery || command.emailQuery)) {
    next = replaceWholeQuery(
      next,
      command.personQuery || command.emailQuery || '',
      resolution.person.name,
      false,
    );
  }

  return next.replace(/\s+/g, ' ').trim();
}

function replaceWholeQuery(
  text: string,
  query: string,
  replacement: string,
  includeCompanySuffix: boolean,
): string {
  if (!query) {
    return text;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffix = includeCompanySuffix ? '(?:\\s+company)?' : '';
  return text.replace(new RegExp(`\\b${escaped}${suffix}\\b`, 'i'), replacement);
}
