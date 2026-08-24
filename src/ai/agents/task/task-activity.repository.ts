import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, SQL } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { auditLogs } from '../../../database/drizzle/schema/audit-log.schema.js';
import { users } from '../../../database/drizzle/schema/user.schema.js';
import {
  TASK_ACTIVITY_ENTITY_TYPE,
  mapLegacyActivityAction,
  sanitizeActivityMetadata,
  type TaskActivityEventType,
} from './task-activity.constants.js';

export type TaskActivityActor = {
  id: string;
  name: string;
} | null;

export type TaskActivityItem = {
  id: string;
  eventType: TaskActivityEventType;
  actor: TaskActivityActor;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type TaskActivityPage = {
  items: TaskActivityItem[];
  total: number;
};

@Injectable()
export class TaskActivityRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async record(input: {
    tenantId: string;
    taskId: string;
    actorUserId?: string | null;
    eventType: TaskActivityEventType;
    metadata?: Record<string, unknown>;
    description?: string | null;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.actorUserId ?? null,
      action: input.eventType,
      entityType: TASK_ACTIVITY_ENTITY_TYPE,
      entityId: input.taskId,
      description: input.description ?? null,
      metadata: sanitizeActivityMetadata(input.metadata),
    });
  }

  async listForTask(input: {
    tenantId: string;
    taskId: string;
    limit: number;
    offset: number;
  }): Promise<TaskActivityPage> {
    const scope = this.taskScope(input.tenantId, input.taskId);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(auditLogs)
      .where(scope);

    const rows = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorId: users.id,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(scope)
      .orderBy(desc(auditLogs.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const items: TaskActivityItem[] = [];
    for (const row of rows) {
      const eventType = mapLegacyActivityAction(row.action);
      if (!eventType) {
        continue;
      }
      items.push({
        id: row.id,
        eventType,
        actor: row.actorId
          ? { id: row.actorId, name: row.actorName || 'User' }
          : null,
        metadata: sanitizeActivityMetadata(
          (row.metadata ?? {}) as Record<string, unknown>,
        ),
        createdAt: row.createdAt,
      });
    }

    return {
      items,
      total: Number(totalRow?.total ?? 0),
    };
  }

  private taskScope(tenantId: string, taskId: string): SQL {
    return and(
      eq(auditLogs.tenantId, tenantId),
      eq(auditLogs.entityId, taskId),
      eq(auditLogs.entityType, TASK_ACTIVITY_ENTITY_TYPE),
    )!;
  }
}
