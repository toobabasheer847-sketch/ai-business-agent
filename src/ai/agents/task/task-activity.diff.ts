import type { TaskCrmEntity, TaskRecord, TaskStatus } from './types/task.types.js';
import type { TaskActivityEventType } from './task-activity.constants.js';

export type ActivityChange = { from: unknown; to: unknown };

export type PlannedActivity = {
  eventType: TaskActivityEventType;
  metadata: Record<string, unknown>;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : null;
  }
  return date.toISOString();
}

function sameId(left?: string | null, right?: string | null): boolean {
  return (left ?? null) === (right ?? null);
}

function fieldChanges(before: TaskRecord, after: TaskRecord): Record<string, ActivityChange> {
  const changes: Record<string, ActivityChange> = {};
  const scalar: Array<keyof TaskRecord> = [
    'title',
    'description',
    'status',
    'priority',
    'assignedTo',
  ];

  for (const key of scalar) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (from !== to) {
      changes[key] = { from, to };
    }
  }

  const fromDue = toIso(before.dueAt);
  const toDue = toIso(after.dueAt);
  if (fromDue !== toDue) {
    changes.dueAt = { from: fromDue, to: toDue };
  }

  return changes;
}

function crmSnapshot(
  type: 'company' | 'prospect' | 'lead',
  id: string | null | undefined,
  entity?: TaskCrmEntity | null,
): Record<string, unknown> | null {
  if (!id) {
    return null;
  }
  return {
    type,
    id,
    name: entity?.name ?? null,
  };
}

export function buildCreateActivities(task: TaskRecord): PlannedActivity[] {
  const events: PlannedActivity[] = [
    {
      eventType: 'TASK_CREATED',
      metadata: {
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueAt: toIso(task.dueAt),
        assignedTo: task.assignedTo ?? null,
      },
    },
  ];

  events.push(...crmLinkEvents(null, null, null, task));
  return events;
}

export function buildUpdateActivities(
  before: TaskRecord,
  after: TaskRecord,
): PlannedActivity[] {
  const events: PlannedActivity[] = [];
  const closed: TaskStatus[] = ['completed', 'cancelled'];
  const wasClosed = closed.includes(before.status);
  const isClosed = closed.includes(after.status);

  if (before.status !== 'completed' && after.status === 'completed') {
    events.push({ eventType: 'TASK_COMPLETED', metadata: {} });
  } else if (before.status !== 'cancelled' && after.status === 'cancelled') {
    events.push({ eventType: 'TASK_CANCELLED', metadata: {} });
  } else if (wasClosed && !isClosed) {
    events.push({
      eventType: 'TASK_REOPENED',
      metadata: { from: before.status, to: after.status },
    });
  }

  const changes = fieldChanges(before, after);
  if (events.some((event) => event.eventType === 'TASK_COMPLETED' || event.eventType === 'TASK_CANCELLED' || event.eventType === 'TASK_REOPENED')) {
    delete changes.status;
  }

  if (Object.keys(changes).length > 0) {
    events.push({ eventType: 'TASK_UPDATED', metadata: { changes } });
  }

  events.push(
    ...crmLinkEvents(
      before.companyId,
      before.prospectId,
      before.leadId,
      after,
      before,
    ),
  );

  return events;
}

export function crmLinkEvents(
  beforeCompanyId: string | null | undefined,
  beforeProspectId: string | null | undefined,
  beforeLeadId: string | null | undefined,
  after: TaskRecord,
  before?: TaskRecord,
): PlannedActivity[] {
  const events: PlannedActivity[] = [];
  const pairs: Array<{
    type: 'company' | 'prospect' | 'lead';
    from: string | null | undefined;
    to: string | null | undefined;
    entity?: TaskCrmEntity | null;
    previous?: TaskCrmEntity | null;
  }> = [
    {
      type: 'company',
      from: beforeCompanyId,
      to: after.companyId,
      entity: after.company,
      previous: before?.company,
    },
    {
      type: 'prospect',
      from: beforeProspectId,
      to: after.prospectId,
      entity: after.prospect,
      previous: before?.prospect,
    },
    {
      type: 'lead',
      from: beforeLeadId,
      to: after.leadId,
      entity: after.lead,
      previous: before?.lead,
    },
  ];

  for (const pair of pairs) {
    if (sameId(pair.from, pair.to)) {
      continue;
    }
    if (pair.from) {
      events.push({
        eventType: 'TASK_CRM_UNLINKED',
        metadata: crmSnapshot(pair.type, pair.from, pair.previous) ?? {
          type: pair.type,
          id: pair.from,
        },
      });
    }
    if (pair.to) {
      events.push({
        eventType: 'TASK_CRM_LINKED',
        metadata: crmSnapshot(pair.type, pair.to, pair.entity) ?? {
          type: pair.type,
          id: pair.to,
        },
      });
    }
  }

  return events;
}
