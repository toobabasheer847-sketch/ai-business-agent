import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, isNotNull, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module.js';
import type { DrizzleDb } from '../../database/database.service.js';
import { auditLogs } from '../../database/drizzle/schema/audit-log.schema.js';
import { companies } from '../../database/drizzle/schema/company.schema.js';
import { conversations } from '../../database/drizzle/schema/conversation.schema.js';
import { leads } from '../../database/drizzle/schema/lead.schema.js';
import { proposals } from '../../database/drizzle/schema/proposal.schema.js';
import { prospects } from '../../database/drizzle/schema/prospect.schema.js';
import { tasks } from '../../database/drizzle/schema/task.schema.js';
import { currentTaskWindows, type DashboardWindow } from './dashboard-range.js';

export type OverviewCounts = {
  companies: number;
  leads: number;
  prospects: number;
  proposals: number;
  draftProposals: number;
  generatedProposals: number;
  sentProposals: number;
  viewedProposals: number;
  acceptedProposals: number;
  rejectedProposals: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
};

export type PipelineCounts = {
  companies: number;
  leads: number;
  prospects: number;
  proposals: number;
  companiesWithLeads: number;
  leadsWithProspects: number;
  prospectsWithProposals: number;
};

export type TaskSnapshot = {
  pending: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
};

export type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  occurredAt: string;
};

export type CommunicationCounts = {
  totalConversations: number;
  emailConversations: number;
  smsConversations: number;
  callConversations: number;
  webConversations: number;
  whatsappConversations: number;
};

export type RecentCommunication = {
  id: string;
  channel: string;
  title: string | null;
  status: string;
  updatedAt: string;
};

const OPEN_OVERDUE = sql`${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} < now()`;

@Injectable()
export class DashboardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async overviewCounts(tenantId: string, window: DashboardWindow, mode: 'lifetime' | 'filtered'): Promise<OverviewCounts> {
    const [companyTotal, leadTotal, prospectTotal, proposalRow, taskRow] = await Promise.all([
      this.countWhere(companies, companies.tenantId, tenantId, mode === 'filtered' ? companies.createdAt : null, window),
      this.countWhere(leads, leads.tenantId, tenantId, mode === 'filtered' ? leads.createdAt : null, window),
      this.countWhere(prospects, prospects.tenantId, tenantId, mode === 'filtered' ? prospects.createdAt : null, window),
      this.proposalCounts(tenantId, window, mode),
      this.taskOverview(tenantId, window, mode),
    ]);

    return {
      companies: companyTotal,
      leads: leadTotal,
      prospects: prospectTotal,
      proposals: proposalRow.total,
      draftProposals: proposalRow.draft,
      generatedProposals: proposalRow.generated,
      sentProposals: proposalRow.sent,
      viewedProposals: proposalRow.viewed,
      acceptedProposals: proposalRow.accepted,
      rejectedProposals: proposalRow.rejected,
      pendingTasks: taskRow.pending,
      completedTasks: taskRow.completed,
      overdueTasks: taskRow.overdue,
    };
  }

  async pipelineCounts(tenantId: string, window: DashboardWindow, mode: 'lifetime' | 'filtered'): Promise<PipelineCounts> {
    const companyDate = this.between(mode === 'filtered' ? companies.createdAt : null, window);
    const leadDate = this.between(mode === 'filtered' ? leads.createdAt : null, window);
    const prospectDate = this.between(mode === 'filtered' ? prospects.createdAt : null, window);
    const proposalDate = this.between(mode === 'filtered' ? proposals.createdAt : null, window);

    const [companiesRow, leadsRow, prospectsRow, proposalsRow, withLeads, withProspects, withProposals] =
      await Promise.all([
        this.db
          .select({ total: count() })
          .from(companies)
          .where(and(eq(companies.tenantId, tenantId), companyDate)),
        this.db
          .select({ total: count() })
          .from(leads)
          .innerJoin(
            companies,
            and(eq(leads.companyId, companies.id), eq(leads.tenantId, companies.tenantId)),
          )
          .where(and(eq(leads.tenantId, tenantId), leadDate)),
        this.db
          .select({ total: count() })
          .from(prospects)
          .innerJoin(
            leads,
            and(eq(prospects.leadId, leads.id), eq(prospects.tenantId, leads.tenantId)),
          )
          .innerJoin(
            companies,
            and(eq(leads.companyId, companies.id), eq(leads.tenantId, companies.tenantId)),
          )
          .where(and(eq(prospects.tenantId, tenantId), prospectDate)),
        this.db
          .select({ total: count() })
          .from(proposals)
          .innerJoin(
            prospects,
            and(eq(proposals.prospectId, prospects.id), eq(proposals.tenantId, prospects.tenantId)),
          )
          .where(and(eq(proposals.tenantId, tenantId), proposalDate)),
        this.db
          .select({ total: sql<number>`count(distinct ${leads.companyId})::int` })
          .from(leads)
          .innerJoin(
            companies,
            and(eq(leads.companyId, companies.id), eq(leads.tenantId, companies.tenantId)),
          )
          .where(and(eq(leads.tenantId, tenantId), leadDate)),
        this.db
          .select({ total: sql<number>`count(distinct ${prospects.leadId})::int` })
          .from(prospects)
          .innerJoin(
            leads,
            and(eq(prospects.leadId, leads.id), eq(prospects.tenantId, leads.tenantId)),
          )
          .where(and(eq(prospects.tenantId, tenantId), prospectDate)),
        this.db
          .select({ total: sql<number>`count(distinct ${proposals.prospectId})::int` })
          .from(proposals)
          .innerJoin(
            prospects,
            and(eq(proposals.prospectId, prospects.id), eq(proposals.tenantId, prospects.tenantId)),
          )
          .where(and(eq(proposals.tenantId, tenantId), proposalDate)),
      ]);

    return {
      companies: Number(companiesRow[0]?.total ?? 0),
      leads: Number(leadsRow[0]?.total ?? 0),
      prospects: Number(prospectsRow[0]?.total ?? 0),
      proposals: Number(proposalsRow[0]?.total ?? 0),
      companiesWithLeads: Number(withLeads[0]?.total ?? 0),
      leadsWithProspects: Number(withProspects[0]?.total ?? 0),
      prospectsWithProposals: Number(withProposals[0]?.total ?? 0),
    };
  }

  async taskSnapshot(tenantId: string, now = new Date()): Promise<TaskSnapshot> {
    const bounds = currentTaskWindows(now);
    const [row] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
        overdue: sql<number>`count(*) filter (where ${OPEN_OVERDUE})::int`,
        dueToday: sql<number>`count(*) filter (where ${tasks.status} <> 'cancelled' and ${tasks.dueAt} >= ${bounds.todayStart} and ${tasks.dueAt} <= ${bounds.todayEnd})::int`,
        dueThisWeek: sql<number>`count(*) filter (where ${tasks.status} <> 'cancelled' and ${tasks.dueAt} >= ${bounds.weekStart} and ${tasks.dueAt} <= ${bounds.weekEnd})::int`,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));

    return {
      pending: Number(row?.pending ?? 0),
      completed: Number(row?.completed ?? 0),
      overdue: Number(row?.overdue ?? 0),
      dueToday: Number(row?.dueToday ?? 0),
      dueThisWeek: Number(row?.dueThisWeek ?? 0),
    };
  }

  async filteredTaskCounts(
    tenantId: string,
    window: DashboardWindow,
  ): Promise<Pick<TaskSnapshot, 'pending' | 'completed' | 'overdue'>> {
    const [row] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending' and ${tasks.createdAt} >= ${window.from} and ${tasks.createdAt} <= ${window.to})::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= ${window.from} and ${tasks.completedAt} <= ${window.to})::int`,
        overdue: sql<number>`count(*) filter (where ${OPEN_OVERDUE} and ${tasks.dueAt} >= ${window.from} and ${tasks.dueAt} <= ${window.to})::int`,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));

    return {
      pending: Number(row?.pending ?? 0),
      completed: Number(row?.completed ?? 0),
      overdue: Number(row?.overdue ?? 0),
    };
  }

  async recentActivity(tenantId: string, window: DashboardWindow): Promise<ActivityItem[]> {
    const [companyRows, leadRows, prospectRows, generatedRows, generatedAudit, sentRows, acceptedRows, rejectedRows, taskCreated, taskCompleted] =
      await Promise.all([
        this.namedRows(companies, companies.tenantId, companies.id, companies.name, companies.createdAt, tenantId, window, 'company.created'),
        this.personRows(leads, leads.tenantId, leads.id, leads.firstName, leads.lastName, leads.createdAt, tenantId, window, 'lead.created'),
        this.personRows(prospects, prospects.tenantId, prospects.id, prospects.firstName, prospects.lastName, prospects.createdAt, tenantId, window, 'prospect.created'),
        this.proposalEvent(tenantId, window, 'generated'),
        this.generatedAudit(tenantId, window),
        this.proposalEvent(tenantId, window, 'sent'),
        this.proposalEvent(tenantId, window, 'accepted'),
        this.proposalEvent(tenantId, window, 'rejected'),
        this.namedRows(tasks, tasks.tenantId, tasks.id, tasks.title, tasks.createdAt, tenantId, window, 'task.created'),
        this.completedTasks(tenantId, window),
      ]);

    const merged = [
      ...companyRows,
      ...leadRows,
      ...prospectRows,
      ...generatedAudit,
      ...generatedRows,
      ...sentRows,
      ...acceptedRows,
      ...rejectedRows,
      ...taskCreated,
      ...taskCompleted,
    ];
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        const key = `${item.kind}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 12);
  }

  async communicationCounts(
    tenantId: string,
    window: DashboardWindow,
    mode: 'lifetime' | 'filtered',
  ): Promise<CommunicationCounts> {
    const date = mode === 'filtered' ? this.between(conversations.createdAt, window) : undefined;
    const rows = await this.db
      .select({
        channel: conversations.channel,
        total: count(),
      })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), date))
      .groupBy(conversations.channel);

    const stats: CommunicationCounts = {
      totalConversations: 0,
      emailConversations: 0,
      smsConversations: 0,
      callConversations: 0,
      webConversations: 0,
      whatsappConversations: 0,
    };
    for (const row of rows) {
      const total = Number(row.total ?? 0);
      stats.totalConversations += total;
      if (row.channel === 'email') stats.emailConversations += total;
      else if (row.channel === 'sms') stats.smsConversations += total;
      else if (row.channel === 'call') stats.callConversations += total;
      else if (row.channel === 'web') stats.webConversations += total;
      else if (row.channel === 'whatsapp') stats.whatsappConversations += total;
    }
    return stats;
  }

  async recentCommunications(tenantId: string, window: DashboardWindow): Promise<RecentCommunication[]> {
    const date = window.from && window.to ? this.between(conversations.updatedAt, window) : undefined;
    const rows = await this.db
      .select({
        id: conversations.id,
        channel: conversations.channel,
        title: conversations.title,
        status: conversations.status,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), date))
      .orderBy(desc(conversations.updatedAt))
      .limit(5);

    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private async proposalCounts(tenantId: string, window: DashboardWindow, mode: 'lifetime' | 'filtered') {
    if (mode === 'lifetime') {
      const [row] = await this.db
        .select({
          total: sql<number>`count(*)::int`,
          draft: sql<number>`count(*) filter (where ${proposals.status} = 'draft')::int`,
          generated: sql<number>`count(*) filter (where ${proposals.status} = 'generated')::int`,
          sent: sql<number>`count(*) filter (where ${proposals.status} = 'sent')::int`,
          viewed: sql<number>`count(*) filter (where ${proposals.status} = 'viewed')::int`,
          accepted: sql<number>`count(*) filter (where ${proposals.status} = 'accepted')::int`,
          rejected: sql<number>`count(*) filter (where ${proposals.status} = 'rejected')::int`,
        })
        .from(proposals)
        .where(eq(proposals.tenantId, tenantId));
      return this.mapProposalRow(row);
    }

    const [row] = await this.db
      .select({
        total: sql<number>`count(*) filter (where ${proposals.createdAt} >= ${window.from} and ${proposals.createdAt} <= ${window.to})::int`,
        draft: sql<number>`count(*) filter (where ${proposals.status} = 'draft' and ${proposals.createdAt} >= ${window.from} and ${proposals.createdAt} <= ${window.to})::int`,
        generated: sql<number>`count(*) filter (where ${proposals.status} = 'generated' and ${proposals.updatedAt} >= ${window.from} and ${proposals.updatedAt} <= ${window.to})::int`,
        sent: sql<number>`count(*) filter (where ${proposals.sentAt} >= ${window.from} and ${proposals.sentAt} <= ${window.to})::int`,
        viewed: sql<number>`count(*) filter (where ${proposals.viewedAt} >= ${window.from} and ${proposals.viewedAt} <= ${window.to})::int`,
        accepted: sql<number>`count(*) filter (where ${proposals.acceptedAt} >= ${window.from} and ${proposals.acceptedAt} <= ${window.to})::int`,
        rejected: sql<number>`count(*) filter (where ${proposals.rejectedAt} >= ${window.from} and ${proposals.rejectedAt} <= ${window.to})::int`,
      })
      .from(proposals)
      .where(eq(proposals.tenantId, tenantId));
    return this.mapProposalRow(row);
  }

  private mapProposalRow(row: {
    total?: number | null;
    draft?: number | null;
    generated?: number | null;
    sent?: number | null;
    viewed?: number | null;
    accepted?: number | null;
    rejected?: number | null;
  } | undefined) {
    return {
      total: Number(row?.total ?? 0),
      draft: Number(row?.draft ?? 0),
      generated: Number(row?.generated ?? 0),
      sent: Number(row?.sent ?? 0),
      viewed: Number(row?.viewed ?? 0),
      accepted: Number(row?.accepted ?? 0),
      rejected: Number(row?.rejected ?? 0),
    };
  }

  private async taskOverview(tenantId: string, window: DashboardWindow, mode: 'lifetime' | 'filtered') {
    if (mode === 'lifetime') {
      const [row] = await this.db
        .select({
          pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending')::int`,
          completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
          overdue: sql<number>`count(*) filter (where ${OPEN_OVERDUE})::int`,
        })
        .from(tasks)
        .where(eq(tasks.tenantId, tenantId));
      return {
        pending: Number(row?.pending ?? 0),
        completed: Number(row?.completed ?? 0),
        overdue: Number(row?.overdue ?? 0),
      };
    }
    return this.filteredTaskCounts(tenantId, window);
  }

  private async countWhere(
    table: typeof companies | typeof leads | typeof prospects,
    tenantColumn: SQLWrapper,
    tenantId: string,
    dateColumn: SQLWrapper | null,
    window: DashboardWindow,
  ): Promise<number> {
    const tenant = tenantColumn as typeof companies.tenantId;
    const [row] = await this.db
      .select({ total: count() })
      .from(table)
      .where(and(eq(tenant, tenantId), this.between(dateColumn, window)));
    return Number(row?.total ?? 0);
  }

  private between(column: SQLWrapper | null, window: DashboardWindow): SQL | undefined {
    if (!column || !window.from || !window.to) return undefined;
    const dateColumn = column as typeof companies.createdAt;
    return and(gte(dateColumn, window.from), lte(dateColumn, window.to));
  }

  private async namedRows(
    table: typeof companies | typeof tasks,
    tenantColumn: SQLWrapper,
    idColumn: SQLWrapper,
    titleColumn: SQLWrapper,
    atColumn: SQLWrapper,
    tenantId: string,
    window: DashboardWindow,
    kind: string,
  ): Promise<ActivityItem[]> {
    const tenant = tenantColumn as typeof companies.tenantId;
    const id = idColumn as typeof companies.id;
    const title = titleColumn as typeof companies.name;
    const at = atColumn as typeof companies.createdAt;
    const rows = await this.db
      .select({ id, title, occurredAt: at })
      .from(table)
      .where(and(eq(tenant, tenantId), this.between(window.from ? at : null, window)))
      .orderBy(desc(at))
      .limit(8);
    return rows.map((row) => ({
      id: row.id,
      kind,
      title: row.title,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  private async personRows(
    table: typeof leads | typeof prospects,
    tenantColumn: SQLWrapper,
    idColumn: SQLWrapper,
    firstColumn: SQLWrapper,
    lastColumn: SQLWrapper,
    atColumn: SQLWrapper,
    tenantId: string,
    window: DashboardWindow,
    kind: string,
  ): Promise<ActivityItem[]> {
    const tenant = tenantColumn as typeof leads.tenantId;
    const id = idColumn as typeof leads.id;
    const firstName = firstColumn as typeof leads.firstName;
    const lastName = lastColumn as typeof leads.lastName;
    const at = atColumn as typeof leads.createdAt;
    const rows = await this.db
      .select({
        id,
        firstName,
        lastName,
        occurredAt: at,
      })
      .from(table)
      .where(and(eq(tenant, tenantId), this.between(window.from ? at : null, window)))
      .orderBy(desc(at))
      .limit(8);
    return rows.map((row) => ({
      id: row.id,
      kind,
      title: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'Untitled',
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  private async proposalEvent(
    tenantId: string,
    window: DashboardWindow,
    event: 'generated' | 'sent' | 'accepted' | 'rejected',
  ): Promise<ActivityItem[]> {
    const atColumn =
      event === 'generated'
        ? proposals.updatedAt
        : event === 'sent'
          ? proposals.sentAt
          : event === 'accepted'
            ? proposals.acceptedAt
            : proposals.rejectedAt;
    const rows = await this.db
      .select({ id: proposals.id, title: proposals.title, occurredAt: atColumn })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, tenantId),
          event === 'generated' ? eq(proposals.status, 'generated') : isNotNull(atColumn),
          this.between(window.from ? atColumn : null, window),
        ),
      )
      .orderBy(desc(atColumn))
      .limit(8);
    return rows.flatMap((row) =>
      row.occurredAt
        ? [{
            id: row.id,
            kind: `proposal.${event}`,
            title: row.title,
            occurredAt: row.occurredAt.toISOString(),
          }]
        : [],
    );
  }

  private async generatedAudit(tenantId: string, window: DashboardWindow): Promise<ActivityItem[]> {
    const rows = await this.db
      .select({
        id: auditLogs.entityId,
        title: proposals.title,
        occurredAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .innerJoin(
        proposals,
        and(eq(auditLogs.entityId, proposals.id), eq(auditLogs.tenantId, proposals.tenantId)),
      )
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.action, 'proposal.generated'),
          this.between(window.from ? auditLogs.createdAt : null, window),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    return rows.flatMap((row) =>
      row.id
        ? [{
            id: row.id,
            kind: 'proposal.generated',
            title: row.title,
            occurredAt: row.occurredAt.toISOString(),
          }]
        : [],
    );
  }

  private async completedTasks(tenantId: string, window: DashboardWindow): Promise<ActivityItem[]> {
    const rows = await this.db
      .select({ id: tasks.id, title: tasks.title, occurredAt: tasks.completedAt })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.status, 'completed'),
          isNotNull(tasks.completedAt),
          this.between(window.from ? tasks.completedAt : null, window),
        ),
      )
      .orderBy(desc(tasks.completedAt))
      .limit(8);
    return rows.flatMap((row) =>
      row.occurredAt
        ? [{
            id: row.id,
            kind: 'task.completed',
            title: row.title,
            occurredAt: row.occurredAt.toISOString(),
          }]
        : [],
    );
  }
}
