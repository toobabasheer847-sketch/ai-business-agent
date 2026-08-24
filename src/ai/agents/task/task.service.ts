import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { UserRepository } from '../../../modules/user/user.repository';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { TaskAnalyticsQueryDto } from './dto/task-analytics-query.dto.js';
import { TaskAnalyticsTrendsQueryDto } from './dto/task-analytics-trends-query.dto.js';
import {
  parseTaskCommand,
  titleMatchesSearch,
  type TaskNlCommand,
} from './parse-task-command.js';
import { endOfUtcDay, startOfUtcDay, addUtcDays } from './parse-task-datetime.js';
import { resolveAssignedToForTenant } from './resolve-assigned-to.js';
import { TaskCrmResolver } from './resolve-crm-entities.js';
import { normalizeCrmIds } from './resolve-crm-ids.js';
import { TaskReminderService } from './task-reminder.service.js';
import { TaskActivityRepository } from './task-activity.repository.js';
import { TaskAnalyticsRepository } from './task-analytics.repository.js';
import {
  resolveAnalyticsRange,
  TREND_MAX_DAYS,
  buildTaskCsv,
} from './task-analytics.metrics.js';
import { toApiReminderStatus } from './task-reminder.constants.js';
import {
  TaskAgentResponse,
  TaskAnalyticsFilters,
  TaskAnalyticsGroupBy,
  TaskAnalyticsReport,
  TaskAnalyticsResult,
  TaskAnalyticsTrendsResult,
  TaskContext,
  TaskNlAnalyticsFocus,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from './types/task.types.js';
import {
  buildCreateActivities,
  buildUpdateActivities,
} from './task-activity.diff.js';
import { TaskRepository } from './task.repository.js';
import { TaskDependencyRepository } from './task-dependency.repository.js';
import {
  computeNextOccurrence,
  isOccurrenceWithinEnd,
  isRecurrenceInterval,
  occurrenceKeyFromDate,
  type RecurrenceInterval,
} from './compute-task-recurrence.js';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
    private readonly crmResolver: TaskCrmResolver,
    @Optional() private readonly reminders?: TaskReminderService,
    @Optional() private readonly activity?: TaskActivityRepository,
    @Optional() private readonly analytics?: TaskAnalyticsRepository,
    @Optional() private readonly dependencies?: TaskDependencyRepository,
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
      const recurrence = this.buildRecurrenceOnCreate(dto);
      const created = await this.taskRepository.createTask({
        tenantId: context.tenantId,
        createdBy: context.userId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as TaskPriority | undefined,
        assignedTo,
        dueAt: this.parseOptionalDueAt(dto.dueAt) ?? recurrence.dueAt,
        companyId: crmIds.companyId ?? null,
        prospectId: crmIds.prospectId ?? null,
        leadId: crmIds.leadId ?? null,
        recurrenceEnabled: recurrence.recurrenceEnabled,
        recurrenceInterval: recurrence.recurrenceInterval,
        recurrenceEndsAt: recurrence.recurrenceEndsAt,
        recurrenceSeriesId: recurrence.recurrenceSeriesId,
        recurrenceOccurrenceKey: recurrence.recurrenceOccurrenceKey,
      });
      await this.reminders?.scheduleReminder(created);
      await this.recordActivities(
        context.tenantId,
        created.id,
        context.userId,
        [
          ...buildCreateActivities(created),
          ...buildRecurrenceActivityEvents(null, created),
        ],
      );
      return this.withReminder(created);
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

    return this.withReminder(task);
  }

  async listTasks(
    dto: TaskQueryDto,
    context: TaskContext,
  ): Promise<TaskRecord[]> {
    this.requireAuthContext(context);

    if (dto.assigneeId) {
      await resolveAssignedToForTenant(
        this.userRepository,
        dto.assigneeId,
        context.tenantId,
      );
    }

    const crmIds = await this.crmResolver.assertIds(context.tenantId, {
      companyId: dto.companyId,
      prospectId: dto.prospectId,
      leadId: dto.leadId,
    });

    const rows = await this.taskRepository.findAllByTenantAndUser(
      context.tenantId,
      context.userId,
      {
        status: dto.status as TaskStatus | undefined,
        priority: dto.priority as TaskPriority | undefined,
        search: dto.search,
        companyId: crmIds.companyId,
        prospectId: crmIds.prospectId,
        leadId: crmIds.leadId,
        overdue: dto.overdue,
        dueFrom: dto.dueFrom,
        dueTo: dto.dueTo,
        openOnly: dto.openOnly,
        reminderStatus: dto.reminderStatus,
        hasReminder: dto.hasReminder,
        reminderFrom: dto.reminderFrom,
        reminderTo: dto.reminderTo,
        assigneeId: dto.assigneeId,
      },
    );

    let decorated = await this.withReminders(rows);
    if (dto.blocked === true) {
      decorated = decorated.filter((task) => task.isBlocked);
    } else if (dto.blocked === false) {
      decorated = decorated.filter((task) => !task.isBlocked);
    }
    return decorated;
  }

  async getAnalytics(
    dto: TaskAnalyticsQueryDto & Pick<TaskAnalyticsFilters, 'rangeField' | 'hasReminder'>,
    context: TaskContext,
    now: Date = new Date(),
  ): Promise<TaskAnalyticsResult> {
    this.requireAuthContext(context);
    const filters = await this.buildAnalyticsFilters(dto, context, { now });
    return this.requireAnalytics().getSummary(
      context.tenantId,
      context.userId,
      filters,
      now,
    );
  }

  async getAnalyticsTrends(
    dto: TaskAnalyticsTrendsQueryDto,
    context: TaskContext,
    now: Date = new Date(),
  ): Promise<TaskAnalyticsTrendsResult> {
    this.requireAuthContext(context);
    const groupBy: TaskAnalyticsGroupBy = dto.groupBy ?? 'day';
    const filters = await this.buildAnalyticsFilters(dto, context, {
      now,
      requiredRange: true,
      maxDays: TREND_MAX_DAYS[groupBy],
    });
    const from = filters.from ?? addUtcDays(now, -29);
    const to = filters.to ?? now;
    const trends = await this.requireAnalytics().getTrends(
      context.tenantId,
      context.userId,
      filters,
      groupBy,
      from,
      to,
      now,
    );

    return {
      groupBy,
      from: from.toISOString(),
      to: to.toISOString(),
      trends,
    };
  }

  async getReport(
    dto: TaskAnalyticsTrendsQueryDto,
    context: TaskContext,
    now: Date = new Date(),
  ): Promise<TaskAnalyticsReport> {
    const groupBy: TaskAnalyticsGroupBy = dto.groupBy ?? 'day';
    const range = resolveAnalyticsRange({
      from: dto.from,
      to: dto.to,
      now,
      required: true,
      maxDays: TREND_MAX_DAYS[groupBy],
    });
    if (!range.ok) {
      throw new BadRequestException(range.message);
    }
    const bounded = {
      ...dto,
      groupBy,
      from: (range.from ?? addUtcDays(now, -29)).toISOString(),
      to: (range.to ?? now).toISOString(),
    };
    const [summary, trends] = await Promise.all([
      this.getAnalytics(bounded, context, now),
      this.getAnalyticsTrends(bounded, context, now),
    ]);

    return {
      ...summary,
      groupBy: trends.groupBy,
      from: trends.from,
      to: trends.to,
      trends: trends.trends,
    };
  }

  async exportAnalyticsCsv(
    dto: TaskAnalyticsQueryDto,
    context: TaskContext,
    now: Date = new Date(),
  ): Promise<string> {
    this.requireAuthContext(context);
    const filters = await this.buildAnalyticsFilters(dto, context, { now });
    const rows = await this.requireAnalytics().listExportRows(
      context.tenantId,
      context.userId,
      filters,
    );
    const reminderByTaskId = new Map<string, string>();
    if (this.reminders && rows.length > 0) {
      const attached = await this.reminders.attachReminderStatus(
        rows.map((row) => ({
          id: row.id,
          tenantId: context.tenantId,
          createdBy: context.userId,
          title: row.title,
          status: row.status as TaskStatus,
          priority: row.priority as TaskPriority,
        })),
      );
      for (const task of attached) {
        if (task.reminder?.status) {
          reminderByTaskId.set(task.id, toApiReminderStatus(task.reminder.status));
        }
      }
    }

    return buildTaskCsv(
      rows.map((row) => ({
        ...row,
        reminderStatus: reminderByTaskId.get(row.id) ?? row.reminderStatus ?? '',
      })),
    );
  }

  async getTaskActivity(
    taskId: string,
    query: PaginationDto,
    context: TaskContext,
  ) {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = this.activity
      ? await this.activity.listForTask({
          tenantId: context.tenantId,
          taskId,
          limit,
          offset: (page - 1) * limit,
        })
      : { items: [], total: 0 };

    return {
      taskId,
      activities: result.items.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        actor: item.actor,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
      },
    };
  }

  async getTaskReminders(taskId: string, context: TaskContext) {
    this.requireAuthContext(context);
    const task = await this.requireAccessibleTask(taskId, context);
    if (!this.reminders) {
      return { taskId, reminders: [] };
    }
    return this.reminders.listReminders(task);
  }

  async enableTaskReminders(taskId: string, context: TaskContext) {
    this.requireAuthContext(context);
    const task = await this.requireAccessibleTask(taskId, context);
    if (!this.reminders) {
      throw new InternalServerErrorException('Task reminders are unavailable');
    }
    return this.reminders.enableReminders(task, context.userId);
  }

  async disableTaskReminders(taskId: string, context: TaskContext) {
    this.requireAuthContext(context);
    const task = await this.requireAccessibleTask(taskId, context);
    if (!this.reminders) {
      throw new InternalServerErrorException('Task reminders are unavailable');
    }
    return this.reminders.disableReminders(task, context.userId);
  }

  async rescheduleTaskReminder(
    taskId: string,
    scheduledAt: string,
    context: TaskContext,
  ) {
    this.requireAuthContext(context);
    const task = await this.requireAccessibleTask(taskId, context);
    if (!this.reminders) {
      throw new InternalServerErrorException('Task reminders are unavailable');
    }
    return this.reminders.rescheduleUpcoming(task, scheduledAt, context.userId);
  }

  async getOverdueTasks(
    dto: TaskQueryDto,
    context: TaskContext,
  ): Promise<TaskRecord[]> {
    return this.listTasks({ ...dto, overdue: true }, context);
  }

  async getUpcomingTasks(
    dto: TaskQueryDto,
    context: TaskContext,
  ): Promise<TaskRecord[]> {
    return this.listTasks(
      {
        ...dto,
        dueFrom: dto.dueFrom ?? new Date().toISOString(),
        openOnly: dto.openOnly ?? true,
      },
      context,
    );
  }

  async updateTask(
    taskId: string,
    dto: UpdateTaskDto,
    context: TaskContext,
  ): Promise<TaskRecord> {
    this.requireAuthContext(context);
    const existing = await this.requireAccessibleTask(taskId, context);

    if (dto.status === 'completed') {
      await this.assertTaskNotBlocked(existing, context);
    }

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

    const recurrencePatch = this.buildRecurrenceOnUpdate(existing, dto);

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
        ...recurrencePatch,
        ...crmPatch(crmIds, dto),
      },
    );

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    await this.reminders?.scheduleReminder(updated);
    await this.recordActivities(
      context.tenantId,
      updated.id,
      context.userId,
      [
        ...buildUpdateActivities(existing, updated),
        ...buildRecurrenceActivityEvents(existing, updated),
      ],
    );
    if (updated.status === 'completed' && existing.status !== 'completed') {
      await this.spawnRecurrenceIfNeeded(updated, context);
      await this.rescheduleDependents(updated, context);
    }
    return this.withReminder(updated);
  }

  async completeTask(
    taskId: string,
    context: TaskContext,
  ): Promise<TaskRecord> {
    this.requireAuthContext(context);
    const existing = await this.requireAccessibleTask(taskId, context);
    await this.assertTaskNotBlocked(existing, context);

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

    await this.recordActivities(
      context.tenantId,
      updated.id,
      context.userId,
      buildUpdateActivities(existing, updated),
    );
    await this.reminders
      ?.disableReminders(updated, context.userId, `task_${updated.status}`)
      .catch(() => undefined);
    await this.spawnRecurrenceIfNeeded(updated, context);
    await this.rescheduleDependents(updated, context);
    return this.withReminder(updated);
  }

  async cancelTask(taskId: string, context: TaskContext): Promise<TaskRecord> {
    this.requireAuthContext(context);
    const existing = await this.requireAccessibleTask(taskId, context);

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

    await this.recordActivities(
      context.tenantId,
      updated.id,
      context.userId,
      buildUpdateActivities(existing, updated),
    );
    await this.reminders
      ?.disableReminders(updated, context.userId, `task_${updated.status}`)
      .catch(() => undefined);
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

    if (command.action === 'analytics') {
      return this.executeAnalyticsCommand(command, context, now);
    }

    if (command.action === 'list_blocked') {
      const blocked = await this.listTasks({ blocked: true, openOnly: true }, context);
      return {
        action: 'list_blocked',
        data: blocked,
        message:
          blocked.length === 0
            ? 'No tasks are blocked by incomplete dependencies.'
            : `Found ${blocked.length} blocked task(s).`,
      };
    }

    if (
      command.action === 'add_dependency' ||
      command.action === 'remove_dependency'
    ) {
      return this.executeDependencyCommand(command, context);
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
          recurrenceEnabled: command.recurrenceEnabled,
          recurrenceInterval: command.recurrenceInterval,
          recurrenceEndsAt: command.recurrenceEndsAt,
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
      const crm = await this.applyCrmToList(command, context);
      if (crm.kind === 'clarify') {
        return {
          action: 'clarify',
          data: null,
          message: crm.message,
        };
      }

      const dueWindow = this.dueWindowFilters(command.dueOn, now);
      const rows = await this.listTasks(
        {
          status: command.status,
          priority: command.priority,
          companyId: crm.companyId,
          prospectId: crm.prospectId,
          leadId: crm.leadId,
          ...dueWindow,
        },
        context,
      );
      const data = rows;

      if (crm.label && data.length === 0) {
        return {
          action: 'clarify',
          data: [],
          message: `I couldn't find any of your tasks for ${crm.label}.`,
        };
      }

      return {
        action: 'list',
        data,
        message: crm.label
          ? `Tasks retrieved for ${crm.label}.`
          : 'Tasks retrieved.',
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

    if (command.action === 'activity') {
      const history = await this.getTaskActivity(resolved.task.id, {}, context);
      return {
        action: 'activity',
        data: resolved.task,
        message: formatActivityMessage(resolved.task.title, history.activities),
      };
    }

    if (command.action === 'reminder_list') {
      const listed = await this.getTaskReminders(resolved.task.id, context);
      return {
        action: 'reminder_list',
        data: resolved.task,
        message: formatReminderListMessage(resolved.task.title, listed.reminders),
      };
    }

    if (command.action === 'reminder_enable') {
      const listed = await this.enableTaskReminders(resolved.task.id, context);
      return {
        action: 'reminder_enable',
        data: resolved.task,
        message: `Reminders enabled for “${resolved.task.title}”. ${formatReminderListMessage(resolved.task.title, listed.reminders)}`,
      };
    }

    if (command.action === 'reminder_disable') {
      const listed = await this.disableTaskReminders(resolved.task.id, context);
      return {
        action: 'reminder_disable',
        data: resolved.task,
        message: `Reminders disabled for “${resolved.task.title}”. ${formatReminderListMessage(resolved.task.title, listed.reminders)}`,
      };
    }

    if (command.action === 'reminder_reschedule') {
      if (!command.dueAt) {
        return {
          action: 'clarify',
          data: null,
          message: 'When should I reschedule the reminder? Use a valid time such as 2 PM.',
        };
      }
      const listed = await this.rescheduleTaskReminder(
        resolved.task.id,
        command.dueAt,
        context,
      );
      return {
        action: 'reminder_reschedule',
        data: resolved.task,
        message: `Reminder rescheduled for “${resolved.task.title}”. ${formatReminderListMessage(resolved.task.title, listed.reminders)}`,
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

  private async executeAnalyticsCommand(
    command: TaskNlCommand,
    context: TaskContext,
    now: Date,
  ): Promise<TaskAgentResponse> {
    const crm = await this.applyCrmToList(command, context);
    if (crm.kind === 'clarify') {
      return {
        action: 'clarify',
        data: null,
        message: crm.message,
      };
    }

    let assigneeId: string | undefined;
    if (command.assigneeQuery) {
      const assignee = await this.resolveAssigneeByName(
        command.assigneeQuery,
        context,
      );
      if (assignee.kind === 'clarify') {
        return {
          action: 'clarify',
          data: null,
          message: assignee.message,
        };
      }
      assigneeId = assignee.id;
    }

    const analytics = await this.getAnalytics(
      {
        from: command.from,
        to: command.to,
        status: command.status,
        priority: command.priority,
        companyId: crm.companyId,
        prospectId: crm.prospectId,
        leadId: crm.leadId,
        assigneeId,
        rangeField: command.rangeField,
        hasReminder: command.hasReminder,
      },
      context,
      now,
    );

    let trendsMessage = '';
    if (command.focus === 'report' || command.focus === 'trends') {
      const grouped = await this.getAnalyticsTrends(
        {
          from: command.from,
          to: command.to,
          status: command.status,
          priority: command.priority,
          companyId: crm.companyId,
          prospectId: crm.prospectId,
          leadId: crm.leadId,
          assigneeId,
          groupBy: command.from && spanDays(command.from, command.to ?? now) > 62 ? 'week' : 'day',
        },
        context,
        now,
      );
      trendsMessage = formatTrendsMessage(grouped.trends);
    }

    const label = [crm.label, assigneeId ? command.assigneeQuery : undefined]
      .filter(Boolean)
      .join(' / ');

    return {
      action: 'analytics',
      data: analytics,
      message: `${formatAnalyticsMessage(command, analytics, label || undefined)}${trendsMessage}`.trim(),
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

    if (crm.status === 'ambiguous') {
      return {
        kind: 'unresolved',
        response: {
          action: 'clarify',
          data: null,
          message: this.formatCrmClarify(crm),
        },
      };
    }

    if (crm.status === 'missing') {
      return {
        kind: 'unresolved',
        response: {
          action: 'clarify',
          data: null,
          message: `I couldn't find a company named ${crm.query}.`,
        },
      };
    }

    const searchTerm = command.searchTerm?.trim();
    const linked =
      crm.status === 'resolved'
        ? linksFromResolution(crm)
        : {
            companyId: undefined as string | undefined,
            prospectId: undefined as string | undefined,
            leadId: undefined as string | undefined,
          };
    const hasCrmLink = Boolean(
      linked.companyId || linked.prospectId || linked.leadId,
    );

    if (!searchTerm && !hasCrmLink) {
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
        {
          companyId: linked.companyId,
          prospectId: linked.prospectId,
          leadId: linked.leadId,
        },
      )
    ).filter((task) =>
      searchTerm ? taskMatchesSearch(task, searchTerm) : true,
    );

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
    if (
      command.explicitCompany &&
      !command.companyQuery &&
      !command.personQuery &&
      !command.emailQuery
    ) {
      return {
        kind: 'clarify',
        message: 'Which company do you mean?',
      };
    }

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

  private async applyCrmToList(
    command: TaskNlCommand,
    context: TaskContext,
  ): Promise<
    | {
        kind: 'ok';
        companyId?: string;
        prospectId?: string;
        leadId?: string;
        label?: string;
      }
    | { kind: 'clarify'; message: string }
  > {
    if (
      command.explicitCompany &&
      !command.companyQuery &&
      !command.personQuery &&
      !command.emailQuery
    ) {
      return {
        kind: 'clarify',
        message: 'Which company do you mean?',
      };
    }

    if (!command.companyQuery && !command.personQuery && !command.emailQuery) {
      return { kind: 'ok' };
    }

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
        message: `I couldn't find a company named ${resolution.query}.`,
      };
    }

    if (resolution.status !== 'resolved') {
      const named =
        command.companyQuery || command.personQuery || command.emailQuery;
      return {
        kind: 'clarify',
        message: named
          ? `I couldn't find a company or contact named ${named}.`
          : 'Which company do you mean?',
      };
    }

    const linked = linksFromResolution(resolution);
    const label =
      resolution.person?.name ||
      resolution.company?.name ||
      command.companyQuery;

    return {
      kind: 'ok',
      companyId: linked.companyId,
      prospectId: linked.prospectId,
      leadId: linked.leadId,
      label,
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

  private async buildAnalyticsFilters(
    dto: TaskAnalyticsQueryDto & Pick<TaskAnalyticsFilters, 'rangeField' | 'hasReminder'>,
    context: TaskContext,
    options: { now: Date; requiredRange?: boolean; maxDays?: number },
  ): Promise<TaskAnalyticsFilters> {
    const range = resolveAnalyticsRange({
      from: dto.from,
      to: dto.to,
      now: options.now,
      required: options.requiredRange,
      maxDays: options.maxDays,
    });
    if (!range.ok) {
      throw new BadRequestException(range.message);
    }

    const assignedTo = await resolveAssignedToForTenant(
      this.userRepository,
      dto.assigneeId,
      context.tenantId,
    );
    const crmIds = await this.crmResolver.assertIds(context.tenantId, {
      companyId: dto.companyId,
      prospectId: dto.prospectId,
      leadId: dto.leadId,
    });

    return {
      from: range.from,
      to: range.to,
      rangeField: dto.rangeField,
      status: dto.status as TaskStatus | undefined,
      priority: dto.priority as TaskPriority | undefined,
      companyId: crmIds.companyId ?? undefined,
      prospectId: crmIds.prospectId ?? undefined,
      leadId: crmIds.leadId ?? undefined,
      assigneeId: assignedTo ?? undefined,
      hasReminder: dto.hasReminder,
    };
  }

  private async resolveAssigneeByName(
    query: string,
    context: TaskContext,
  ): Promise<{ kind: 'ok'; id: string } | { kind: 'clarify'; message: string }> {
    const matches = await this.userRepository.findAllByTenant(context.tenantId, {
      search: query,
    });
    const needle = query.trim().toLowerCase();
    const filtered = matches.filter((user) => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name === needle || email === needle || name.includes(needle);
    });

    if (filtered.length === 0) {
      return {
        kind: 'clarify',
        message: `I couldn't find anyone named ${query} in your tenant.`,
      };
    }
    if (filtered.length > 1) {
      const names = filtered
        .slice(0, 5)
        .map((user) => user.name || user.email)
        .join(', ');
      return {
        kind: 'clarify',
        message: `I found ${filtered.length} people matching ${query}: ${names}. Which assignee do you mean?`,
      };
    }

    return { kind: 'ok', id: filtered[0].id };
  }

  private requireAnalytics(): TaskAnalyticsRepository {
    if (!this.analytics) {
      throw new InternalServerErrorException('Failed to load task analytics');
    }

    return this.analytics;
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

  private dueWindowFilters(
    dueOn: 'today' | 'tomorrow' | 'overdue' | 'upcoming' | undefined,
    now: Date,
  ): Pick<TaskQueryDto, 'overdue' | 'dueFrom' | 'dueTo' | 'openOnly'> {
    if (dueOn === 'overdue') {
      return { overdue: true };
    }
    if (dueOn === 'today') {
      return {
        dueFrom: startOfUtcDay(now).toISOString(),
        dueTo: endOfUtcDay(now).toISOString(),
      };
    }
    if (dueOn === 'tomorrow') {
      const tomorrow = addUtcDays(now, 1);
      return {
        dueFrom: startOfUtcDay(tomorrow).toISOString(),
        dueTo: endOfUtcDay(tomorrow).toISOString(),
      };
    }
    if (dueOn === 'upcoming') {
      return {
        dueFrom: now.toISOString(),
        openOnly: true,
      };
    }
    return {};
  }

  private async withReminder(task: TaskRecord): Promise<TaskRecord> {
    const [attached] = await this.withReminders([task]);
    return attached;
  }

  private async withReminders(tasks: TaskRecord[]): Promise<TaskRecord[]> {
    let withStatus = tasks;
    if (this.reminders && tasks.length > 0) {
      try {
        withStatus = await this.reminders.attachReminderStatus(tasks);
      } catch {
        withStatus = tasks;
      }
    }

    if (!this.dependencies || withStatus.length === 0) {
      return withStatus.map((task) => ({
        ...task,
        isBlocked: false,
        blockedBy: [],
        nextOccurrenceAt: this.computeNextOccurrencePreview(task),
      }));
    }

    const tenantId = withStatus[0].tenantId;
    const blockedIds = await this.dependencies.listBlockedTaskIds(
      tenantId,
      withStatus.map((task) => task.id),
    );

    const decorated: TaskRecord[] = [];
    for (const task of withStatus) {
      const isBlocked = blockedIds.has(task.id);
      const blockedBy =
        isBlocked && withStatus.length === 1
          ? await this.dependencies.listIncompleteBlockers(tenantId, task.id)
          : [];
      decorated.push({
        ...task,
        isBlocked,
        blockedBy,
        nextOccurrenceAt: this.computeNextOccurrencePreview(task),
      });
    }
    return decorated;
  }

  private computeNextOccurrencePreview(task: TaskRecord): string | null {
    if (
      !task.recurrenceEnabled ||
      !isRecurrenceInterval(task.recurrenceInterval) ||
      !task.dueAt
    ) {
      return null;
    }
    const due = new Date(task.dueAt);
    if (Number.isNaN(due.getTime())) {
      return null;
    }
    const next = computeNextOccurrence(due, task.recurrenceInterval);
    if (!isOccurrenceWithinEnd(next, task.recurrenceEndsAt)) {
      return null;
    }
    return next.toISOString();
  }

  private async assertTaskNotBlocked(
    task: TaskRecord,
    context: TaskContext,
  ): Promise<void> {
    if (!this.dependencies) {
      return;
    }
    const blockers = await this.dependencies.listIncompleteBlockers(
      context.tenantId,
      task.id,
    );
    if (blockers.length === 0) {
      return;
    }
    await this.recordActivities(context.tenantId, task.id, context.userId, [
      {
        eventType: 'TASK_BLOCKED_COMPLETION_REJECTED',
        metadata: {
          blockedBy: blockers.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
          })),
        },
      },
    ]);
    throw new BadRequestException(
      `Task is blocked by incomplete dependencies: ${blockers
        .map((item) => item.title)
        .join(', ')}`,
    );
  }

  private buildRecurrenceOnCreate(dto: CreateTaskDto): {
    dueAt?: Date | string;
    recurrenceEnabled: boolean;
    recurrenceInterval: string | null;
    recurrenceEndsAt: Date | string | null;
    recurrenceSeriesId: string | null;
    recurrenceOccurrenceKey: string | null;
  } {
    const interval = dto.recurrenceInterval;
    const enabled = dto.recurrenceEnabled === true || Boolean(interval);
    if (!enabled) {
      return {
        recurrenceEnabled: false,
        recurrenceInterval: null,
        recurrenceEndsAt: null,
        recurrenceSeriesId: null,
        recurrenceOccurrenceKey: null,
      };
    }
    if (!isRecurrenceInterval(interval ?? '')) {
      throw new BadRequestException(
        'Recurrence interval must be daily, weekly, or monthly.',
      );
    }
    const dueAt = this.parseOptionalDueAt(dto.dueAt) ?? new Date().toISOString();
    const dueDate = new Date(dueAt);
    return {
      dueAt,
      recurrenceEnabled: dto.recurrenceEnabled !== false,
      recurrenceInterval: interval ?? null,
      recurrenceEndsAt: this.parseOptionalDueAt(dto.recurrenceEndsAt) ?? null,
      recurrenceSeriesId: randomUUID(),
      recurrenceOccurrenceKey: occurrenceKeyFromDate(dueDate),
    };
  }

  private buildRecurrenceOnUpdate(
    existing: TaskRecord,
    dto: UpdateTaskDto,
  ): Partial<{
    recurrenceEnabled: boolean;
    recurrenceInterval: string | null;
    recurrenceEndsAt: Date | string | null;
    recurrenceSeriesId: string | null;
    recurrenceOccurrenceKey: string | null;
  }> {
    if (
      dto.recurrenceEnabled === undefined &&
      dto.recurrenceInterval === undefined &&
      dto.recurrenceEndsAt === undefined
    ) {
      return {};
    }

    const enabled =
      dto.recurrenceEnabled === undefined
        ? Boolean(existing.recurrenceEnabled)
        : dto.recurrenceEnabled;

    if (!enabled) {
      return {
        recurrenceEnabled: false,
        recurrenceInterval: null,
        recurrenceEndsAt: null,
        recurrenceSeriesId: null,
        recurrenceOccurrenceKey: null,
      };
    }

    const interval =
      dto.recurrenceInterval === undefined
        ? existing.recurrenceInterval
        : dto.recurrenceInterval;
    if (!isRecurrenceInterval(interval ?? '')) {
      throw new BadRequestException(
        'Recurrence interval must be daily, weekly, or monthly.',
      );
    }

    const dueSource =
      this.parseOptionalDueAt(dto.dueAt) ?? existing.dueAt ?? new Date();
    const dueDate = new Date(dueSource as string | Date);

    return {
      recurrenceEnabled: true,
      recurrenceInterval: interval,
      recurrenceEndsAt:
        dto.recurrenceEndsAt === undefined
          ? existing.recurrenceEndsAt ?? null
          : this.parseOptionalDueAt(dto.recurrenceEndsAt) ?? null,
      recurrenceSeriesId: existing.recurrenceSeriesId ?? randomUUID(),
      recurrenceOccurrenceKey:
        existing.recurrenceOccurrenceKey ?? occurrenceKeyFromDate(dueDate),
    };
  }

  private async spawnRecurrenceIfNeeded(
    completed: TaskRecord,
    context: TaskContext,
  ): Promise<TaskRecord | null> {
    if (
      !completed.recurrenceEnabled ||
      !isRecurrenceInterval(completed.recurrenceInterval) ||
      !completed.recurrenceSeriesId
    ) {
      return null;
    }

    const from = completed.dueAt ? new Date(completed.dueAt) : new Date();
    if (Number.isNaN(from.getTime())) {
      return null;
    }

    const interval = completed.recurrenceInterval as RecurrenceInterval;
    const nextDue = computeNextOccurrence(from, interval);
    if (!isOccurrenceWithinEnd(nextDue, completed.recurrenceEndsAt)) {
      return null;
    }

    const nextKey = occurrenceKeyFromDate(nextDue);
    const existing = await this.taskRepository.findBySeriesOccurrence(
      context.tenantId,
      completed.recurrenceSeriesId,
      nextKey,
    );
    if (existing) {
      return existing;
    }

    try {
      const spawned = await this.taskRepository.createTask({
        tenantId: context.tenantId,
        createdBy: completed.createdBy,
        assignedTo: completed.assignedTo ?? null,
        companyId: completed.companyId ?? null,
        prospectId: completed.prospectId ?? null,
        leadId: completed.leadId ?? null,
        title: completed.title,
        description: completed.description ?? null,
        priority: completed.priority,
        dueAt: nextDue,
        recurrenceEnabled: true,
        recurrenceInterval: interval,
        recurrenceEndsAt: completed.recurrenceEndsAt ?? null,
        recurrenceSeriesId: completed.recurrenceSeriesId,
        recurrenceOccurrenceKey: nextKey,
      });
      await this.reminders?.scheduleReminder(spawned);
      await this.recordActivities(
        context.tenantId,
        spawned.id,
        context.userId,
        buildCreateActivities(spawned),
      );
      await this.recordActivities(context.tenantId, completed.id, context.userId, [
        {
          eventType: 'TASK_RECURRENCE_SPAWNED',
          metadata: {
            nextTaskId: spawned.id,
            recurrenceSeriesId: completed.recurrenceSeriesId,
            recurrenceOccurrenceKey: nextKey,
            recurrenceInterval: interval,
            dueAt: nextDue.toISOString(),
          },
        },
      ]);
      return spawned;
    } catch (error) {
      const duplicate = await this.taskRepository.findBySeriesOccurrence(
        context.tenantId,
        completed.recurrenceSeriesId,
        nextKey,
      );
      if (duplicate) {
        return duplicate;
      }
      throw error;
    }
  }

  private async rescheduleDependents(
    completed: TaskRecord,
    context: TaskContext,
  ): Promise<void> {
    if (!this.dependencies) {
      return;
    }
    const dependents = await this.dependencies.listDependents(
      context.tenantId,
      completed.id,
    );
    for (const edge of dependents) {
      const task = await this.taskRepository.findByIdAndTenantAndUser(
        edge.taskId,
        context.tenantId,
        context.userId,
      );
      if (!task) {
        continue;
      }
      const blockers = await this.dependencies.listIncompleteBlockers(
        context.tenantId,
        task.id,
      );
      if (blockers.length === 0) {
        await this.reminders?.scheduleReminder(task);
      }
    }
  }

  async addTaskDependency(
    taskId: string,
    dependsOnTaskId: string,
    context: TaskContext,
  ) {
    this.requireAuthContext(context);
    if (!this.dependencies) {
      throw new InternalServerErrorException(
        'Task dependencies are not available',
      );
    }
    if (taskId === dependsOnTaskId) {
      throw new BadRequestException('A task cannot depend on itself.');
    }

    const task = await this.requireAccessibleTask(taskId, context);
    const prerequisite = await this.taskRepository.findByIdAndTenantAndUser(
      dependsOnTaskId,
      context.tenantId,
      context.userId,
    );
    if (!prerequisite) {
      throw new NotFoundException('Prerequisite task not found');
    }
    if (prerequisite.tenantId !== task.tenantId) {
      throw new ForbiddenException('Tasks must belong to the same tenant.');
    }

    const existing = await this.dependencies.findPair(
      context.tenantId,
      taskId,
      dependsOnTaskId,
    );
    if (existing) {
      throw new ConflictException('This dependency already exists.');
    }

    if (
      await this.wouldCreateCycle(context.tenantId, taskId, dependsOnTaskId)
    ) {
      throw new BadRequestException(
        'This dependency would create a cycle and was rejected.',
      );
    }

    try {
      const created = await this.dependencies.create({
        tenantId: context.tenantId,
        taskId,
        dependsOnTaskId,
      });
      await this.recordActivities(context.tenantId, taskId, context.userId, [
        {
          eventType: 'TASK_DEPENDENCY_ADDED',
          metadata: {
            dependsOnTaskId,
            dependsOnTitle: prerequisite.title,
          },
        },
      ]);
      return created;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This dependency already exists.');
      }
      throw error;
    }
  }

  async removeTaskDependency(
    taskId: string,
    dependsOnTaskId: string,
    context: TaskContext,
  ) {
    this.requireAuthContext(context);
    await this.requireAccessibleTask(taskId, context);
    if (!this.dependencies) {
      throw new InternalServerErrorException(
        'Task dependencies are not available',
      );
    }
    const deleted = await this.dependencies.deletePair(
      context.tenantId,
      taskId,
      dependsOnTaskId,
    );
    if (!deleted) {
      throw new NotFoundException('Dependency not found');
    }
    await this.recordActivities(context.tenantId, taskId, context.userId, [
      {
        eventType: 'TASK_DEPENDENCY_REMOVED',
        metadata: { dependsOnTaskId },
      },
    ]);
    return { message: 'Dependency removed', taskId, dependsOnTaskId };
  }

  async getTaskDependencies(taskId: string, context: TaskContext) {
    this.requireAuthContext(context);
    const task = await this.requireAccessibleTask(taskId, context);
    if (!this.dependencies) {
      return {
        taskId,
        isBlocked: false,
        blockedBy: [],
        dependsOn: [],
        dependents: [],
      };
    }
    const [dependsOn, dependents, blockers] = await Promise.all([
      this.dependencies.listDependsOn(context.tenantId, taskId),
      this.dependencies.listDependents(context.tenantId, taskId),
      this.dependencies.listIncompleteBlockers(context.tenantId, taskId),
    ]);
    return {
      taskId: task.id,
      isBlocked: blockers.length > 0,
      blockedBy: blockers,
      dependsOn,
      dependents,
    };
  }

  private async wouldCreateCycle(
    tenantId: string,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<boolean> {
    if (!this.dependencies) {
      return false;
    }
    const visited = new Set<string>();
    const queue = [dependsOnTaskId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === taskId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const next = await this.dependencies.listDependsOnIds(tenantId, current);
      queue.push(...next);
    }
    return false;
  }

  private isUniqueViolation(error: unknown): boolean {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    return code === '23505';
  }

  private async executeDependencyCommand(
    command: TaskNlCommand,
    context: TaskContext,
  ): Promise<TaskAgentResponse> {
    const task = command.searchTerm
      ? await this.resolveNlTask(command.searchTerm, context)
      : null;
    const prerequisite = command.dependencySearchTerm
      ? await this.resolveNlTask(command.dependencySearchTerm, context)
      : null;

    if (!task || !prerequisite) {
      return {
        action: 'clarify',
        data: null,
        message:
          'Which tasks should I link? Name both tasks, for example “Make Send proposal depend on Create proposal.”',
      };
    }

    if (command.action === 'remove_dependency') {
      await this.removeTaskDependency(task.id, prerequisite.id, context);
      return {
        action: 'remove_dependency',
        data: await this.getTask(task.id, context),
        message: `Removed the dependency between “${task.title}” and “${prerequisite.title}”.`,
      };
    }

    await this.addTaskDependency(task.id, prerequisite.id, context);
    return {
      action: 'add_dependency',
      data: await this.getTask(task.id, context),
      message: `“${task.title}” now depends on “${prerequisite.title}”.`,
    };
  }

  private async resolveNlTask(
    searchTerm: string,
    context: TaskContext,
  ): Promise<TaskRecord | null> {
    const uuid =
      searchTerm.match(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
      )?.[0];
    if (uuid) {
      return this.taskRepository.findByIdAndTenantAndUser(
        uuid,
        context.tenantId,
        context.userId,
      );
    }
    const matches = await this.taskRepository.findByTitleAndTenantAndUser(
      searchTerm,
      context.tenantId,
      context.userId,
    );
    const exact = matches.filter((item) =>
      titleMatchesSearch(item.title, searchTerm),
    );
    if (exact.length === 1) {
      return exact[0];
    }
    if (matches.length === 1) {
      return matches[0];
    }
    return null;
  }

  private async recordActivities(
    tenantId: string,
    taskId: string,
    actorUserId: string | null,
    events: ReturnType<typeof buildCreateActivities>,
  ): Promise<void> {
    if (!this.activity || events.length === 0) {
      return;
    }

    for (const event of events) {
      try {
        await this.activity.record({
          tenantId,
          taskId,
          actorUserId,
          eventType: event.eventType,
          metadata: event.metadata,
        });
      } catch (error) {
        console.error('TaskService activity write failed (non-fatal)', error);
      }
    }
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
      error instanceof ForbiddenException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    console.error(`TaskService.${operation} failed`, error);
    throw new InternalServerErrorException(`Failed to ${operation}`);
  }
}

function formatActivityMessage(
  title: string,
  activities: Array<{
    eventType: string;
    actor: { name: string } | null;
    createdAt: Date | string;
    metadata: Record<string, unknown>;
  }>,
): string {
  if (activities.length === 0) {
    return `No activity recorded for “${title}”.`;
  }

  const lines = activities.slice(0, 20).map((item) => {
    const when =
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt);
    const actor = item.actor?.name || 'System';
    return `- ${item.eventType} by ${actor} at ${when}`;
  });

  return `Activity for “${title}”:\n${lines.join('\n')}`;
}

function formatReminderListMessage(
  title: string,
  reminders: Array<{
    type: string;
    status: string;
    scheduledAt: string;
    channel: string | null;
  }>,
): string {
  if (reminders.length === 0) {
    return `No reminders are recorded for “${title}”.`;
  }

  const lines = reminders.map(
    (item) =>
      `- ${item.type} ${item.status} at ${item.scheduledAt}${item.channel ? ` via ${item.channel}` : ''}`,
  );
  return `Reminders for “${title}”:\n${lines.join('\n')}`;
}

function formatAnalyticsMessage(
  command: TaskNlCommand,
  analytics: TaskAnalyticsResult,
  label?: string,
): string {
  const { summary } = analytics;
  const focus: TaskNlAnalyticsFocus = command.focus ?? 'summary';
  const scoped = label ? ` for ${label}` : '';

  if (focus === 'overdue') {
    const priorityLabel = command.priority ? ` ${command.priority} priority` : '';
    return `You have ${summary.overdue} overdue${priorityLabel} task${summary.overdue === 1 ? '' : 's'}${scoped}.`;
  }

  if (focus === 'completed') {
    return `You completed ${summary.completed} task${summary.completed === 1 ? '' : 's'}${scoped}${command.from ? ' in that period' : ''}.`;
  }

  if (focus === 'priority' && command.priority) {
    const count = analytics.priority[command.priority];
    const open =
      command.priority === 'high'
        ? summary.highPriorityOpen
        : command.priority === 'urgent'
          ? summary.urgentOpen
          : count;
    return `You have ${count} ${command.priority} priority task${count === 1 ? '' : 's'}${scoped}${command.priority === 'high' || command.priority === 'urgent' ? ` (${open} still open)` : ''}.`;
  }

  if (focus === 'reminders') {
    return `${summary.total} of your tasks have reminders${scoped}. Scheduled ${analytics.reminders.scheduled}, sent ${analytics.reminders.sent}, failed ${analytics.reminders.failed}. Reminder success rate is ${analytics.reminderSuccessRate}%.`;
  }

  if (focus === 'rate') {
    return `Your task completion rate is ${analytics.completionRate}%${scoped}. Overdue rate is ${analytics.overdueRate}%.`;
  }

  if (focus === 'activity') {
    const { activity } = analytics;
    return `Task activity${scoped}: ${activity.created} created, ${activity.updated} updated, ${activity.completed} completed, ${activity.cancelled} cancelled, ${activity.reopened} reopened.`;
  }

  if (focus === 'trends') {
    return `Task trends${scoped}: ${analytics.summary.total} tasks in range, ${analytics.summary.completed} completed, ${analytics.summary.overdue} overdue.`;
  }

  if (focus === 'report') {
    return `Task report${scoped}: ${analytics.summary.total} total (${analytics.summary.pending} pending, ${analytics.summary.inProgress} in progress, ${analytics.summary.completed} completed, ${analytics.summary.cancelled} cancelled). Completion rate ${analytics.completionRate}%, overdue rate ${analytics.overdueRate}%.`;
  }

  return `You have ${summary.total} task${summary.total === 1 ? '' : 's'}${scoped} (${summary.pending} pending, ${summary.inProgress} in progress, ${summary.completed} completed, ${summary.cancelled} cancelled). Completion rate ${analytics.completionRate}%, overdue rate ${analytics.overdueRate}%.`;
}

function formatTrendsMessage(
  trends: Array<{ period: string; created: number; completed: number; overdue: number }>,
): string {
  if (trends.length === 0) {
    return '';
  }
  const created = trends.reduce((sum, row) => sum + row.created, 0);
  const completed = trends.reduce((sum, row) => sum + row.completed, 0);
  const overdue = trends.reduce((sum, row) => sum + row.overdue, 0);
  return ` Trends: ${created} created, ${completed} completed, ${overdue} overdue across ${trends.length} period${trends.length === 1 ? '' : 's'}.`;
}

function spanDays(from: string, to: Date | string): number {
  const start = new Date(from).getTime();
  const end = (to instanceof Date ? to : new Date(to)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function buildRecurrenceActivityEvents(
  before: TaskRecord | null,
  after: TaskRecord,
): Array<{
  eventType:
    | 'TASK_RECURRENCE_ENABLED'
    | 'TASK_RECURRENCE_DISABLED';
  metadata: Record<string, unknown>;
}> {
  const wasEnabled = Boolean(before?.recurrenceEnabled);
  const isEnabled = Boolean(after.recurrenceEnabled);
  if (wasEnabled === isEnabled) {
    return [];
  }
  if (isEnabled) {
    return [
      {
        eventType: 'TASK_RECURRENCE_ENABLED',
        metadata: {
          recurrenceInterval: after.recurrenceInterval ?? null,
          recurrenceEndsAt:
            after.recurrenceEndsAt instanceof Date
              ? after.recurrenceEndsAt.toISOString()
              : after.recurrenceEndsAt ?? null,
          recurrenceSeriesId: after.recurrenceSeriesId ?? null,
        },
      },
    ];
  }
  return [
    {
      eventType: 'TASK_RECURRENCE_DISABLED',
      metadata: {
        previousInterval: before?.recurrenceInterval ?? null,
        previousSeriesId: before?.recurrenceSeriesId ?? null,
      },
    },
  ];
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
    titleMatchesSearch(task.lead?.name ?? '', searchTerm) ||
    titleMatchesSearch(task.lead?.email ?? '', searchTerm) ||
    titleMatchesSearch(task.prospect?.email ?? '', searchTerm)
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
