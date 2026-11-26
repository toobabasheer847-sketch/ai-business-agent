import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  auditLogs,
  companies,
  conversations,
  messages,
  proposals,
  prospects,
  retentionAccounts,
  retentionActionPlans,
  retentionAssessments,
  retentionFeedback,
  retentionPolicies,
  retentionRecommendations,
  tasks,
  users,
} from '../../database/drizzle/schema';
import type { CustomerEvidence } from './retention-rules';

const CUSTOMER_LIMIT = 100;

function uniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

@Injectable()
export class CustomerRetentionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async policy(tenantId: string) {
    const [row] = await this.db.select().from(retentionPolicies).where(eq(retentionPolicies.tenantId, tenantId)).limit(1);
    return row ?? null;
  }

  async savePolicy(tenantId: string, userId: string, value: {
    inactivityDays: number;
    unansweredDays: number;
    stalledProposalDays: number;
    unresolvedConversationDays: number;
    followUpDueDays: number;
  }) {
    const existing = await this.policy(tenantId);
    if (!existing) {
      const [created] = await this.db.insert(retentionPolicies).values({ tenantId, updatedBy: userId, ...value }).returning();
      return created;
    }
    const [updated] = await this.db.update(retentionPolicies).set({ ...value, updatedBy: userId, updatedAt: new Date() })
      .where(eq(retentionPolicies.id, existing.id)).returning();
    return updated;
  }

  async evidence(tenantId: string): Promise<{ customers: CustomerEvidence[]; truncated: boolean }> {
    const accepted = await this.db
      .select({
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(companies)
      .innerJoin(prospects, and(eq(prospects.companyId, companies.id), eq(prospects.tenantId, tenantId)))
      .innerJoin(proposals, and(eq(proposals.prospectId, prospects.id), eq(proposals.tenantId, tenantId), eq(proposals.status, 'accepted')))
      .where(eq(companies.tenantId, tenantId))
      .groupBy(companies.id, companies.name)
      .limit(CUSTOMER_LIMIT + 1);
    const truncated = accepted.length > CUSTOMER_LIMIT;
    const selected = accepted.slice(0, CUSTOMER_LIMIT);
    const ids = selected.map((row) => row.companyId);
    if (!ids.length) return { customers: [], truncated: false };
    const [proposalRows, taskRows, conversationRows] = await Promise.all([
      this.db.select({
        companyId: prospects.companyId,
        id: proposals.id,
        title: proposals.title,
        status: proposals.status,
        sentAt: proposals.sentAt,
        viewedAt: proposals.viewedAt,
        acceptedAt: proposals.acceptedAt,
        rejectedAt: proposals.rejectedAt,
      }).from(proposals).innerJoin(prospects, eq(proposals.prospectId, prospects.id))
        .where(and(eq(proposals.tenantId, tenantId), inArray(prospects.companyId, ids))),
      this.db.select({
        id: tasks.id,
        companyId: tasks.companyId,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
      }).from(tasks).where(and(eq(tasks.tenantId, tenantId), inArray(tasks.companyId, ids))),
      this.db.select({
        id: conversations.id,
        companyId: conversations.companyId,
        status: conversations.status,
        updatedAt: conversations.updatedAt,
      }).from(conversations).where(and(eq(conversations.tenantId, tenantId), inArray(conversations.companyId, ids))),
    ]);
    const conversationIds = conversationRows.map((row) => row.id);
    const messageRows = conversationIds.length
      ? await this.db.select({
        id: messages.id,
        conversationId: messages.conversationId,
        direction: messages.direction,
        content: messages.content,
        createdAt: messages.createdAt,
      }).from(messages).where(and(eq(messages.tenantId, tenantId), inArray(messages.conversationId, conversationIds)))
        .orderBy(desc(messages.createdAt))
        .limit(500)
      : [];
    const now = new Date();
    return {
      truncated,
      customers: selected.map((company) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        proposals: proposalRows.filter((row) => row.companyId === company.companyId).map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          sentAt: row.sentAt,
          viewedAt: row.viewedAt,
          acceptedAt: row.acceptedAt,
          rejectedAt: row.rejectedAt,
        })),
        conversations: conversationRows.filter((row) => row.companyId === company.companyId).map((row) => ({
          id: row.id,
          status: row.status,
          updatedAt: row.updatedAt,
        })),
        messages: messageRows.filter((row) => conversationRows.some((conversation) => conversation.id === row.conversationId && conversation.companyId === company.companyId)).map((row) => ({
          id: row.id,
          conversationId: row.conversationId,
          direction: row.direction,
          content: row.content,
          createdAt: row.createdAt,
        })),
        tasks: taskRows.filter((row) => row.companyId === company.companyId).map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          dueAt: row.dueAt,
        })),
        now,
      })),
    };
  }

  async companyName(tenantId: string, companyId: string) {
    const [row] = await this.db.select({ name: companies.name }).from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId))).limit(1);
    return row?.name ?? null;
  }

  async account(tenantId: string, companyId: string) {
    const [row] = await this.db.select().from(retentionAccounts)
      .where(and(eq(retentionAccounts.tenantId, tenantId), eq(retentionAccounts.companyId, companyId))).limit(1);
    return row ?? null;
  }

  async upsertAccount(values: typeof retentionAccounts.$inferInsert) {
    const existing = await this.account(values.tenantId, values.companyId);
    if (!existing) {
      const [created] = await this.db.insert(retentionAccounts).values(values).returning();
      return created;
    }
    const [updated] = await this.db.update(retentionAccounts).set({ ...values, updatedAt: new Date() })
      .where(eq(retentionAccounts.id, existing.id)).returning();
    return updated;
  }

  async addAssessment(values: typeof retentionAssessments.$inferInsert) {
    await this.db.insert(retentionAssessments).values(values);
  }

  async listAccounts(tenantId: string, classification: string | undefined, page: number, limit: number) {
    const where = classification
      ? and(eq(retentionAccounts.tenantId, tenantId), eq(retentionAccounts.classification, classification))
      : eq(retentionAccounts.tenantId, tenantId);
    const [total] = await this.db.select({ total: sql<number>`count(*)::int` }).from(retentionAccounts).where(where);
    const data = await this.db.select({
      account: retentionAccounts,
      companyName: companies.name,
    }).from(retentionAccounts)
      .innerJoin(companies, eq(companies.id, retentionAccounts.companyId))
      .where(where)
      .orderBy(desc(retentionAccounts.assessedAt))
      .limit(limit)
      .offset((page - 1) * limit);
    return { data, total: Number(total?.total ?? 0) };
  }

  async recommendationKeys(tenantId: string) {
    return this.db.select({ signalKey: retentionRecommendations.signalKey }).from(retentionRecommendations)
      .where(eq(retentionRecommendations.tenantId, tenantId));
  }

  async insertRecommendation(values: typeof retentionRecommendations.$inferInsert) {
    try {
      const [created] = await this.db.insert(retentionRecommendations).values(values).returning();
      return created ?? null;
    } catch (error) {
      if (uniqueViolation(error)) return null;
      throw error;
    }
  }

  async recommendations(tenantId: string, companyId?: string) {
    const where = companyId
      ? and(eq(retentionRecommendations.tenantId, tenantId), eq(retentionRecommendations.companyId, companyId))
      : eq(retentionRecommendations.tenantId, tenantId);
    return this.db.select().from(retentionRecommendations).where(where).orderBy(desc(retentionRecommendations.createdAt)).limit(200);
  }

  async recommendation(tenantId: string, id: string) {
    const [row] = await this.db.select().from(retentionRecommendations)
      .where(and(eq(retentionRecommendations.tenantId, tenantId), eq(retentionRecommendations.id, id))).limit(1);
    return row ?? null;
  }

  async updateRecommendation(tenantId: string, id: string, values: Partial<typeof retentionRecommendations.$inferInsert>) {
    const [row] = await this.db.update(retentionRecommendations).set({ ...values, updatedAt: new Date() })
      .where(and(eq(retentionRecommendations.tenantId, tenantId), eq(retentionRecommendations.id, id))).returning();
    return row ?? null;
  }

  async taskForMarker(tenantId: string, marker: string) {
    const [row] = await this.db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), sql`${tasks.description} like ${'%' + marker + '%'}`))
      .limit(1);
    return row ?? null;
  }

  async plans(tenantId: string, companyId?: string) {
    const where = companyId
      ? and(eq(retentionActionPlans.tenantId, tenantId), eq(retentionActionPlans.companyId, companyId))
      : eq(retentionActionPlans.tenantId, tenantId);
    return this.db.select().from(retentionActionPlans).where(where).orderBy(desc(retentionActionPlans.createdAt)).limit(200);
  }

  async plan(tenantId: string, id: string) {
    const [row] = await this.db.select().from(retentionActionPlans)
      .where(and(eq(retentionActionPlans.tenantId, tenantId), eq(retentionActionPlans.id, id))).limit(1);
    return row ?? null;
  }

  async insertPlan(values: typeof retentionActionPlans.$inferInsert) {
    const [row] = await this.db.insert(retentionActionPlans).values(values).returning();
    return row;
  }

  async updatePlan(tenantId: string, id: string, values: Partial<typeof retentionActionPlans.$inferInsert>) {
    const [row] = await this.db.update(retentionActionPlans).set({ ...values, updatedAt: new Date() })
      .where(and(eq(retentionActionPlans.tenantId, tenantId), eq(retentionActionPlans.id, id))).returning();
    return row ?? null;
  }

  async insertFeedback(values: typeof retentionFeedback.$inferInsert) {
    try {
      await this.db.insert(retentionFeedback).values(values);
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
    }
  }

  async feedback(tenantId: string, companyId?: string) {
    const where = companyId
      ? and(eq(retentionFeedback.tenantId, tenantId), eq(retentionFeedback.companyId, companyId))
      : eq(retentionFeedback.tenantId, tenantId);
    return this.db.select().from(retentionFeedback).where(where).orderBy(desc(retentionFeedback.observedAt)).limit(200);
  }

  async updateFeedback(tenantId: string, id: string, polarity: string, reviewStatus: string, userId: string) {
    const [row] = await this.db.update(retentionFeedback).set({
      polarity,
      reviewStatus,
      reviewedBy: userId,
      updatedAt: new Date(),
    }).where(and(eq(retentionFeedback.tenantId, tenantId), eq(retentionFeedback.id, id))).returning();
    return row ?? null;
  }

  async history(tenantId: string, companyId: string) {
    return this.db.select().from(retentionAssessments)
      .where(and(eq(retentionAssessments.tenantId, tenantId), eq(retentionAssessments.companyId, companyId)))
      .orderBy(desc(retentionAssessments.assessedAt))
      .limit(20);
  }

  async userInTenant(tenantId: string, userId: string) {
    const [row] = await this.db.select({ id: users.id }).from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId), eq(users.isActive, true))).limit(1);
    return Boolean(row);
  }

  async counts(tenantId: string) {
    const accounts = await this.db.select({
      classification: retentionAccounts.classification,
      signals: retentionAccounts.signals,
    }).from(retentionAccounts).where(eq(retentionAccounts.tenantId, tenantId));
    const [openRecommendations] = await this.db.select({ total: sql<number>`count(*)::int` }).from(retentionRecommendations)
      .where(and(eq(retentionRecommendations.tenantId, tenantId), eq(retentionRecommendations.status, 'open')));
    const plans = await this.db.select({ status: retentionActionPlans.status, total: sql<number>`count(*)::int` })
      .from(retentionActionPlans).where(eq(retentionActionPlans.tenantId, tenantId)).groupBy(retentionActionPlans.status);
    return { accounts, openRecommendations: Number(openRecommendations?.total ?? 0), plans };
  }

  async audit(input: { tenantId: string; userId: string; action: string; entityType: string; entityId?: string | null; description: string }) {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description.slice(0, 500),
      metadata: {},
    });
  }
}
