import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { aiApprovals } from '../../database/drizzle/schema/ai-approval.schema';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import { leads } from '../../database/drizzle/schema/lead.schema';
import { proposals } from '../../database/drizzle/schema/proposal.schema';
import { prospects } from '../../database/drizzle/schema/prospect.schema';
import { taskReminders } from '../../database/drizzle/schema/task-reminder.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { tenants } from '../../database/drizzle/schema/tenant.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import {
  DEFAULT_DETECTION_CONFIG,
  type DetectionSnapshot,
} from './exception.types';

const LIMIT = 200;

@Injectable()
export class ExceptionSource {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async listTenantIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(500);
    return rows.map((row) => row.id);
  }

  async load(tenantId: string, now: Date): Promise<DetectionSnapshot> {
    const config = DEFAULT_DETECTION_CONFIG;
    const soon = new Date(now.getTime() + config.dueSoonHours * 60 * 60 * 1000);
    const highCutoff = new Date(
      now.getTime() - config.highPriorityOpenDays * 86_400_000,
    );
    const staleCutoff = new Date(
      now.getTime() - config.staleOpenDays * 86_400_000,
    );
    const leadCutoff = new Date(
      now.getTime() - config.leadUncontactedDays * 86_400_000,
    );
    const prospectCutoff = new Date(
      now.getTime() - config.prospectStaleDays * 86_400_000,
    );
    const lookback = new Date(now.getTime() - config.lookbackDays * 86_400_000);

    const [
      taskRows,
      leadRows,
      prospectRows,
      proposalRows,
      reminderRows,
      runRows,
      approvalRows,
    ] = await Promise.all([
      this.db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueAt: tasks.dueAt,
          createdAt: tasks.createdAt,
          assignedTo: tasks.assignedTo,
          assigneeActive: users.isActive,
          companyId: tasks.companyId,
        })
        .from(tasks)
        .leftJoin(
          users,
          and(eq(tasks.assignedTo, users.id), eq(users.tenantId, tenantId)),
        )
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            inArray(tasks.status, ['pending', 'in_progress']),
            or(
              lt(tasks.dueAt, soon),
              and(
                inArray(tasks.priority, ['high', 'urgent']),
                lt(tasks.createdAt, highCutoff),
              ),
              and(isNull(tasks.dueAt), lt(tasks.createdAt, staleCutoff)),
              eq(users.isActive, false),
            ),
          ),
        )
        .orderBy(tasks.dueAt)
        .limit(LIMIT),
      this.db
        .select({
          id: leads.id,
          name: sql<string>`trim(${leads.firstName} || ' ' || coalesce(${leads.lastName}, ''))`,
          email: leads.email,
          phone: leads.phone,
          status: leads.status,
          createdAt: leads.createdAt,
          companyId: leads.companyId,
        })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            or(
              and(
                or(isNull(leads.email), eq(leads.email, '')),
                or(isNull(leads.phone), eq(leads.phone, '')),
              ),
              and(eq(leads.status, 'new'), lt(leads.createdAt, leadCutoff)),
            ),
          ),
        )
        .orderBy(leads.createdAt)
        .limit(LIMIT),
      this.db
        .select({
          id: prospects.id,
          name: sql<string>`trim(${prospects.firstName} || ' ' || coalesce(${prospects.lastName}, ''))`,
          status: prospects.status,
          updatedAt: prospects.updatedAt,
          companyId: prospects.companyId,
        })
        .from(prospects)
        .where(
          and(
            eq(prospects.tenantId, tenantId),
            inArray(prospects.status, ['new', 'contacted']),
            lt(prospects.updatedAt, prospectCutoff),
          ),
        )
        .orderBy(prospects.updatedAt)
        .limit(LIMIT),
      this.db
        .select({
          id: proposals.id,
          title: proposals.title,
          status: proposals.status,
          sentAt: proposals.sentAt,
          viewedAt: proposals.viewedAt,
          validUntil: proposals.validUntil,
        })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            inArray(proposals.status, ['sent', 'viewed', 'expired']),
          ),
        )
        .orderBy(desc(proposals.updatedAt))
        .limit(LIMIT),
      this.db
        .select({
          id: taskReminders.id,
          taskId: taskReminders.taskId,
          status: taskReminders.status,
          attemptCount: taskReminders.attemptCount,
          channel: taskReminders.channel,
        })
        .from(taskReminders)
        .where(
          and(
            eq(taskReminders.tenantId, tenantId),
            eq(taskReminders.status, 'failed'),
          ),
        )
        .orderBy(desc(taskReminders.processedAt))
        .limit(LIMIT),
      this.db
        .select({
          id: agentRuns.id,
          agentName: agentRuns.agentName,
          status: agentRuns.status,
          durationMs: agentRuns.durationMs,
          costStatus: agentRuns.costStatus,
          startedAt: agentRuns.startedAt,
        })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.tenantId, tenantId),
            gte(agentRuns.startedAt, lookback),
          ),
        )
        .orderBy(desc(agentRuns.startedAt))
        .limit(LIMIT),
      this.db
        .select({
          id: aiApprovals.id,
          title: aiApprovals.title,
          status: aiApprovals.status,
          actionType: aiApprovals.actionType,
          createdAt: aiApprovals.createdAt,
          expiresAt: aiApprovals.expiresAt,
        })
        .from(aiApprovals)
        .where(
          and(
            eq(aiApprovals.tenantId, tenantId),
            inArray(aiApprovals.status, ['pending', 'failed', 'expired']),
          ),
        )
        .orderBy(aiApprovals.createdAt)
        .limit(LIMIT),
    ]);

    const truncated = [
      taskRows,
      leadRows,
      prospectRows,
      proposalRows,
      reminderRows,
      runRows,
      approvalRows,
    ].some((rows) => rows.length >= LIMIT);
    return {
      now,
      truncated,
      tasks: taskRows,
      leads: leadRows,
      prospects: prospectRows,
      proposals: proposalRows,
      reminders: reminderRows,
      runs: runRows,
      approvals: approvalRows,
    };
  }
}
