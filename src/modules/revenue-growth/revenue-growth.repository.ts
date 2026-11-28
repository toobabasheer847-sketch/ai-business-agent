import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  auditLogs,
  companies,
  conversations,
  growthActionPlans,
  growthOpportunities,
  growthOpportunityEvents,
  growthPolicies,
  leads,
  messages,
  proposals,
  prospects,
  tasks,
  users,
} from '../../database/drizzle/schema';
import type { GrowthEvidence } from './growth-rules';

function uniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

@Injectable()
export class RevenueGrowthRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async policy(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(growthPolicies)
      .where(eq(growthPolicies.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  }

  async savePolicy(
    tenantId: string,
    userId: string,
    value: { leadQuietDays: number; proposalFollowUpDays: number },
  ) {
    const existing = await this.policy(tenantId);
    if (!existing) {
      const [created] = await this.db
        .insert(growthPolicies)
        .values({ tenantId, updatedBy: userId, ...value })
        .returning();
      return created;
    }
    const [updated] = await this.db
      .update(growthPolicies)
      .set({ ...value, updatedBy: userId, updatedAt: new Date() })
      .where(eq(growthPolicies.id, existing.id))
      .returning();
    return updated;
  }

  async saveScan(
    tenantId: string,
    userId: string,
    scan: { insufficientLeads: number; truncated: boolean },
  ) {
    const existing = await this.policy(tenantId);
    if (!existing) {
      const [created] = await this.db
        .insert(growthPolicies)
        .values({
          tenantId,
          updatedBy: userId,
          lastInsufficientLeads: scan.insufficientLeads,
          lastTruncated: scan.truncated,
        })
        .returning();
      return created;
    }
    const [updated] = await this.db
      .update(growthPolicies)
      .set({
        lastInsufficientLeads: scan.insufficientLeads,
        lastTruncated: scan.truncated,
        updatedAt: new Date(),
      })
      .where(eq(growthPolicies.id, existing.id))
      .returning();
    return updated;
  }

  async evidence(
    tenantId: string,
  ): Promise<GrowthEvidence & { truncated: boolean }> {
    const leadRows = await this.db
      .select({
        id: leads.id,
        companyId: leads.companyId,
        firstName: leads.firstName,
        lastName: leads.lastName,
        status: leads.status,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .orderBy(desc(leads.updatedAt))
      .limit(201);

    const proposalRows = await this.db
      .select({
        id: proposals.id,
        companyId: prospects.companyId,
        prospectId: proposals.prospectId,
        leadId: prospects.leadId,
        title: proposals.title,
        status: proposals.status,
        sentAt: proposals.sentAt,
        viewedAt: proposals.viewedAt,
        acceptedAt: proposals.acceptedAt,
        rejectedAt: proposals.rejectedAt,
        rejectionReason: proposals.rejectionReason,
        validUntil: proposals.validUntil,
      })
      .from(proposals)
      .innerJoin(
        prospects,
        and(
          eq(proposals.prospectId, prospects.id),
          eq(prospects.tenantId, tenantId),
        ),
      )
      .where(eq(proposals.tenantId, tenantId))
      .orderBy(desc(proposals.updatedAt))
      .limit(201);

    const acceptedRows = await this.db
      .select({ companyId: prospects.companyId })
      .from(proposals)
      .innerJoin(prospects, eq(proposals.prospectId, prospects.id))
      .where(
        and(eq(proposals.tenantId, tenantId), eq(proposals.status, 'accepted')),
      )
      .limit(500);

    const messageRows = await this.db
      .select({
        id: messages.id,
        companyId: conversations.companyId,
        leadId: conversations.leadId,
        conversationId: messages.conversationId,
        direction: messages.direction,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(messages.tenantId, tenantId))
      .orderBy(desc(messages.createdAt))
      .limit(500);

    const taskRows = await this.db
      .select({
        id: tasks.id,
        leadId: tasks.leadId,
        companyId: tasks.companyId,
        prospectId: tasks.prospectId,
        status: tasks.status,
        dueAt: tasks.dueAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId))
      .limit(400);

    const prospectRows = await this.db
      .select({
        id: prospects.id,
        companyId: prospects.companyId,
        leadId: prospects.leadId,
        firstName: prospects.firstName,
        lastName: prospects.lastName,
        updatedAt: prospects.updatedAt,
      })
      .from(prospects)
      .where(eq(prospects.tenantId, tenantId))
      .orderBy(desc(prospects.updatedAt))
      .limit(201);

    const conversationRows = await this.db
      .select({
        id: conversations.id,
        companyId: conversations.companyId,
        leadId: conversations.leadId,
        status: conversations.status,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.updatedAt))
      .limit(200);

    return {
      now: new Date(),
      truncated:
        leadRows.length > 200 ||
        proposalRows.length > 200 ||
        prospectRows.length > 200,
      leads: leadRows.slice(0, 200).map((lead) => ({
        id: lead.id,
        companyId: lead.companyId,
        name: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
        status: lead.status,
        updatedAt: lead.updatedAt,
      })),
      prospects: prospectRows.slice(0, 200).map((prospect) => ({
        id: prospect.id,
        companyId: prospect.companyId,
        leadId: prospect.leadId,
        name: `${prospect.firstName} ${prospect.lastName ?? ''}`.trim(),
        updatedAt: prospect.updatedAt,
      })),
      proposals: proposalRows
        .slice(0, 200)
        .map((proposal) => ({ ...proposal, status: String(proposal.status) })),
      messages: messageRows.map((message) => ({
        id: message.id,
        companyId: message.companyId,
        leadId: message.leadId,
        conversationId: message.conversationId,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt,
      })),
      tasks: taskRows.map((task) => ({ ...task, status: String(task.status) })),
      conversations: conversationRows,
      acceptedCompanyIds: [
        ...new Set(acceptedRows.map((row) => row.companyId)),
      ],
    };
  }

  async stored(tenantId: string) {
    return this.db
      .select({
        id: growthOpportunities.id,
        signalKey: growthOpportunities.signalKey,
        status: growthOpportunities.status,
      })
      .from(growthOpportunities)
      .where(eq(growthOpportunities.tenantId, tenantId))
      .limit(2000);
  }

  async insertOpportunity(values: typeof growthOpportunities.$inferInsert) {
    try {
      const [row] = await this.db
        .insert(growthOpportunities)
        .values({
          ...values,
          title: values.title.slice(0, 180),
          description: values.description.slice(0, 800),
          evidence: values.evidence.slice(0, 800),
          recommendedAction: values.recommendedAction.slice(0, 400),
        })
        .returning();
      return row ?? null;
    } catch (error) {
      if (uniqueViolation(error)) return null;
      throw error;
    }
  }

  async updateOpportunity(
    tenantId: string,
    id: string,
    patch: Partial<typeof growthOpportunities.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(growthOpportunities)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(growthOpportunities.tenantId, tenantId),
          eq(growthOpportunities.id, id),
        ),
      )
      .returning();
    return row ?? null;
  }

  async addEvent(input: {
    tenantId: string;
    opportunityId: string;
    fromStatus: string | null;
    toStatus: string;
    note: string;
    actorId: string | null;
  }) {
    await this.db
      .insert(growthOpportunityEvents)
      .values({ ...input, note: input.note.slice(0, 400) });
  }

  async list(
    tenantId: string,
    filter: {
      type?: string;
      status?: string;
      priority?: string;
      page: number;
      limit: number;
    },
  ) {
    const conditions = [eq(growthOpportunities.tenantId, tenantId)];
    if (filter.type)
      conditions.push(eq(growthOpportunities.opportunityType, filter.type));
    if (filter.status)
      conditions.push(eq(growthOpportunities.status, filter.status));
    if (filter.priority)
      conditions.push(eq(growthOpportunities.priority, filter.priority));
    const where = and(...conditions);
    const offset = (filter.page - 1) * filter.limit;
    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(growthOpportunities)
      .where(where);
    const data = await this.db
      .select({
        opportunity: growthOpportunities,
        companyName: companies.name,
      })
      .from(growthOpportunities)
      .innerJoin(companies, eq(growthOpportunities.companyId, companies.id))
      .where(where)
      .orderBy(
        desc(growthOpportunities.priorityRank),
        desc(growthOpportunities.createdAt),
      )
      .limit(filter.limit)
      .offset(offset);
    return { data, total: Number(countRow?.total ?? 0) };
  }

  async opportunity(tenantId: string, id: string) {
    const [row] = await this.db
      .select({
        opportunity: growthOpportunities,
        companyName: companies.name,
      })
      .from(growthOpportunities)
      .innerJoin(companies, eq(growthOpportunities.companyId, companies.id))
      .where(
        and(
          eq(growthOpportunities.tenantId, tenantId),
          eq(growthOpportunities.id, id),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async events(tenantId: string, opportunityId: string) {
    return this.db
      .select()
      .from(growthOpportunityEvents)
      .where(
        and(
          eq(growthOpportunityEvents.tenantId, tenantId),
          eq(growthOpportunityEvents.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(growthOpportunityEvents.createdAt))
      .limit(100);
  }

  async plans(tenantId: string, opportunityId?: string) {
    const where = opportunityId
      ? and(
          eq(growthActionPlans.tenantId, tenantId),
          eq(growthActionPlans.opportunityId, opportunityId),
        )
      : eq(growthActionPlans.tenantId, tenantId);
    return this.db
      .select()
      .from(growthActionPlans)
      .where(where)
      .orderBy(desc(growthActionPlans.createdAt))
      .limit(200);
  }

  async plan(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(growthActionPlans)
      .where(
        and(
          eq(growthActionPlans.tenantId, tenantId),
          eq(growthActionPlans.id, id),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertPlan(values: typeof growthActionPlans.$inferInsert) {
    const [row] = await this.db
      .insert(growthActionPlans)
      .values(values)
      .returning();
    return row;
  }

  async updatePlan(
    tenantId: string,
    id: string,
    patch: Partial<typeof growthActionPlans.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(growthActionPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(growthActionPlans.tenantId, tenantId),
          eq(growthActionPlans.id, id),
        ),
      )
      .returning();
    return row ?? null;
  }

  async companyHasAccepted(tenantId: string, companyId: string) {
    const [row] = await this.db
      .select({ id: proposals.id })
      .from(proposals)
      .innerJoin(prospects, eq(proposals.prospectId, prospects.id))
      .where(
        and(
          eq(proposals.tenantId, tenantId),
          eq(prospects.companyId, companyId),
          eq(proposals.status, 'accepted'),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async leadStatus(tenantId: string, leadId: string) {
    const [row] = await this.db
      .select({ status: leads.status })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
      .limit(1);
    return row?.status ?? null;
  }

  async companyName(tenantId: string, companyId: string) {
    const [row] = await this.db
      .select({ name: companies.name })
      .from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId)))
      .limit(1);
    return row?.name ?? null;
  }

  async userInTenant(tenantId: string, userId: string) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async taskForMarker(tenantId: string, marker: string) {
    const [row] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          sql`${tasks.description} like ${'%' + marker + '%'}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async snapshot(tenantId: string) {
    const rows = await this.db
      .select({
        type: growthOpportunities.opportunityType,
        status: growthOpportunities.status,
        priority: growthOpportunities.priority,
        id: growthOpportunities.id,
        signalKey: growthOpportunities.signalKey,
        title: growthOpportunities.title,
        evidence: growthOpportunities.evidence,
        assignedTo: growthOpportunities.assignedTo,
        companyId: growthOpportunities.companyId,
      })
      .from(growthOpportunities)
      .where(eq(growthOpportunities.tenantId, tenantId))
      .limit(2000);
    const planRows = await this.db
      .select({
        opportunityId: growthActionPlans.opportunityId,
        status: growthActionPlans.status,
      })
      .from(growthActionPlans)
      .where(eq(growthActionPlans.tenantId, tenantId))
      .limit(2000);
    const overdue = await this.db
      .select({ id: growthOpportunities.id })
      .from(growthOpportunities)
      .innerJoin(tasks, eq(growthOpportunities.taskId, tasks.id))
      .where(
        and(
          eq(growthOpportunities.tenantId, tenantId),
          inArray(tasks.status, ['pending', 'in_progress']),
          sql`${tasks.dueAt} is not null and ${tasks.dueAt} < now()`,
        ),
      );
    return { rows, planRows, overdueIds: overdue.map((row) => row.id) };
  }

  async audit(input: {
    tenantId: string;
    userId: string;
    action: string;
    entityId?: string | null;
    description: string;
  }) {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entityType: 'growth_opportunity',
      entityId: input.entityId ?? null,
      description: input.description.slice(0, 500),
    });
  }
}
