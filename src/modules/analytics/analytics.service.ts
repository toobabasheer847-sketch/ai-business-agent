import { Injectable, UnauthorizedException } from '@nestjs/common';

import { TeamAnalyticsService } from '../../ai/agents/team/team-analytics.service.js';
import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import type { DashboardWindow } from '../dashboard/dashboard-range.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { buildInsights, type AnalyticsInsight } from './analytics-insights.js';
import {
  compareMetric,
  previousWindow,
  rate,
  resolveAnalyticsWindow,
  windowFromMessage,
  windowLabel,
  type AnalyticsComparison,
  type AnalyticsRate,
} from './analytics-range.js';

const LEAD_CONVERSION = 'Distinct leads created in the period that have a prospect with the same tenant and leadId, divided by leads created in the period. This is the current foreign-key relationship, not a historical stage transition.';
const ACCEPTANCE = 'Proposals with acceptedAt in the period, divided by proposals with sentAt in the period. Drafts and unsent generated proposals are not in the denominator.';
const COMPLETION = 'Current completed tasks divided by pending + in progress + completed. Cancelled tasks are excluded from both sides. Overdue tasks are not added again.';
const PERIOD_COMPLETION = 'Tasks with completedAt in the period and status completed, divided by tasks created in the period. Cancelled tasks are not counted as completed.';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly analytics: AnalyticsRepository,
    private readonly teamAnalytics: TeamAnalyticsService,
  ) {}

  async overview(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [lifetime, current, previous, pipeline] = await Promise.all([
      this.dashboard.overviewCounts(tenantId, windows.current, 'lifetime'),
      this.dashboard.overviewCounts(tenantId, windows.current, 'filtered'),
      windows.previous ? this.dashboard.overviewCounts(tenantId, windows.previous, 'filtered') : Promise.resolve(null),
      this.dashboard.pipelineCounts(tenantId, windows.current, 'filtered'),
    ]);
    return {
      window: this.serialize(windows.current),
      previousWindow: windows.previous ? this.serialize(windows.previous) : null,
      lifetimeLabeled: lifetime,
      currentPeriod: current,
      previousPeriod: previous,
      comparisons: {
        companies: compareMetric(current.companies, previous?.companies ?? null),
        leads: compareMetric(current.leads, previous?.leads ?? null),
        prospects: compareMetric(current.prospects, previous?.prospects ?? null),
        proposals: compareMetric(current.proposals, previous?.proposals ?? null),
        acceptedProposals: compareMetric(current.acceptedProposals, previous?.acceptedProposals ?? null),
        pendingTasks: compareMetric(current.pendingTasks, previous?.pendingTasks ?? null),
        completedTasks: compareMetric(current.completedTasks, previous?.completedTasks ?? null),
        overdueTasks: compareMetric(current.overdueTasks, previous?.overdueTasks ?? null),
      },
      pipeline,
      unsupported: ['revenue', 'expenses', 'profit', 'employeeHours', 'historicalStageChanges', 'messagesSent'],
    };
  }

  async sales(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [pipeline, previousPipeline, conversion, previousConversion, leadStatus, prospectStatus] = await Promise.all([
      this.dashboard.pipelineCounts(tenantId, windows.current, 'filtered'),
      windows.previous ? this.dashboard.pipelineCounts(tenantId, windows.previous, 'filtered') : Promise.resolve(null),
      this.analytics.leadConversion(tenantId, windows.current),
      windows.previous ? this.analytics.leadConversion(tenantId, windows.previous) : Promise.resolve(null),
      this.analytics.statusCounts(tenantId, 'leads', windows.current),
      this.analytics.statusCounts(tenantId, 'prospects', windows.current),
    ]);
    return {
      window: this.serialize(windows.current),
      previousWindow: windows.previous ? this.serialize(windows.previous) : null,
      pipeline,
      comparisons: {
        companies: compareMetric(pipeline.companies, previousPipeline?.companies ?? null),
        leads: compareMetric(pipeline.leads, previousPipeline?.leads ?? null),
        prospects: compareMetric(pipeline.prospects, previousPipeline?.prospects ?? null),
        proposals: compareMetric(pipeline.proposals, previousPipeline?.proposals ?? null),
      },
      leadToProspect: rate(conversion.withProspect, conversion.leads, LEAD_CONVERSION),
      previousLeadToProspect: previousConversion
        ? rate(previousConversion.withProspect, previousConversion.leads, LEAD_CONVERSION)
        : null,
      leadStatus,
      prospectStatus,
      note: 'Pipeline counts are records created in the period and joined on company, lead, prospect, and proposal foreign keys. Status charts are current status values for records created in the period. There is no status-history table.',
    };
  }

  async proposals(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [current, previous, timing, previousTiming] = await Promise.all([
      this.dashboard.overviewCounts(tenantId, windows.current, 'filtered'),
      windows.previous ? this.dashboard.overviewCounts(tenantId, windows.previous, 'filtered') : Promise.resolve(null),
      this.analytics.proposalTiming(tenantId, windows.current),
      windows.previous ? this.analytics.proposalTiming(tenantId, windows.previous) : Promise.resolve(null),
    ]);
    return {
      window: this.serialize(windows.current),
      previousWindow: windows.previous ? this.serialize(windows.previous) : null,
      currentStatusEvents: {
        draft: current.draftProposals,
        generated: current.generatedProposals,
        sent: current.sentProposals,
        viewed: current.viewedProposals,
        accepted: current.acceptedProposals,
        rejected: current.rejectedProposals,
        expired: timing.expired,
        cancelled: timing.cancelled,
      },
      comparisons: {
        sent: compareMetric(current.sentProposals, previous?.sentProposals ?? null),
        accepted: compareMetric(current.acceptedProposals, previous?.acceptedProposals ?? null),
        rejected: compareMetric(current.rejectedProposals, previous?.rejectedProposals ?? null),
      },
      acceptanceRate: rate(timing.accepted, timing.sentPopulation, ACCEPTANCE),
      rejectionRate: rate(current.rejectedProposals, timing.sentPopulation, 'Proposals with rejectedAt in the period, divided by proposals with sentAt in the period.'),
      previousAcceptanceRate: previousTiming ? rate(previousTiming.accepted, previousTiming.sentPopulation, ACCEPTANCE) : null,
      averageSentToAcceptedHours: timing.averageSentToAcceptedHours,
      previousAverageSentToAcceptedHours: previousTiming?.averageSentToAcceptedHours ?? null,
      note: 'Sent, viewed, accepted, and rejected use their own timestamps. Expired and cancelled use current status and updatedAt because no dedicated timestamp is stored. One proposal is counted once per event timestamp.',
    };
  }

  async tasks(tenantId: string, query: { range?: string; from?: string; to?: string }, scopeUserId?: string) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    if (scopeUserId) {
      const status = await this.analytics.taskStatus(tenantId, windows.current, scopeUserId);
      return {
        window: this.serialize(windows.current),
        previousWindow: windows.previous ? this.serialize(windows.previous) : null,
        snapshot: status,
        status,
        completionRate: rate(status.completed, status.pending + status.inProgress + status.completed, COMPLETION),
        periodCompletionRate: rate(status.completed, status.createdInPeriod, PERIOD_COMPLETION),
        comparisons: {
          completed: compareMetric(status.completed, null),
          overdue: compareMetric(status.overdue, null),
          pendingCreated: compareMetric(status.createdInPeriod, null),
        },
        note: 'This view includes only tasks you created or that are assigned to you. Tenant-wide task totals are not included.',
      };
    }
    const [snapshot, status, currentFiltered, previousFiltered] = await Promise.all([
      this.dashboard.taskSnapshot(tenantId),
      this.analytics.taskStatus(tenantId, windows.current, scopeUserId),
      this.dashboard.filteredTaskCounts(tenantId, windows.current),
      windows.previous ? this.dashboard.filteredTaskCounts(tenantId, windows.previous) : Promise.resolve(null),
    ]);
    return {
      window: this.serialize(windows.current),
      previousWindow: windows.previous ? this.serialize(windows.previous) : null,
      snapshot,
      status,
      completionRate: rate(status.completed, status.pending + status.inProgress + status.completed, COMPLETION),
      periodCompletionRate: rate(currentFiltered.completed, status.createdInPeriod, PERIOD_COMPLETION),
      comparisons: {
        completed: compareMetric(currentFiltered.completed, previousFiltered?.completed ?? null),
        overdue: compareMetric(currentFiltered.overdue, previousFiltered?.overdue ?? null),
        pendingCreated: compareMetric(currentFiltered.pending, previousFiltered?.pending ?? null),
      },
      note: 'Snapshot counts are current task status. Period completed counts use completedAt. Overdue means pending or in progress with dueAt in the past; completed and cancelled tasks are excluded. Working hours are not stored.',
    };
  }

  async team(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [employees, deadlines] = await Promise.all([
      this.teamAnalytics.getEmployeeWorkload(tenantId),
      this.teamAnalytics.getUpcomingDeadlines(tenantId),
    ]);
    return {
      window: this.serialize(windows.current),
      members: employees.map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.employeeName,
        pending: employee.pending,
        inProgress: employee.inProgress,
        completed: employee.completed,
        cancelled: employee.cancelled,
        overdue: employee.overdue,
        open: employee.pending + employee.inProgress,
        upcoming: employee.upcoming,
      })),
      upcomingDeadlines: deadlines.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        dueAt: item.dueAt,
        assigneeName: item.assigneeName,
      })),
      note: 'Workload is the current open task count per active user. It is not hours, attendance, or a productivity score. Inactive users are excluded.',
    };
  }

  async communications(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [current, previous, statuses] = await Promise.all([
      this.dashboard.communicationCounts(tenantId, windows.current, 'filtered'),
      windows.previous ? this.dashboard.communicationCounts(tenantId, windows.previous, 'filtered') : Promise.resolve(null),
      this.analytics.statusCounts(tenantId, 'conversations', windows.current),
    ]);
    return {
      window: this.serialize(windows.current),
      previousWindow: windows.previous ? this.serialize(windows.previous) : null,
      conversations: current,
      comparisons: {
        total: compareMetric(current.totalConversations, previous?.totalConversations ?? null),
        email: compareMetric(current.emailConversations, previous?.emailConversations ?? null),
        sms: compareMetric(current.smsConversations, previous?.smsConversations ?? null),
        call: compareMetric(current.callConversations, previous?.callConversations ?? null),
        web: compareMetric(current.webConversations, previous?.webConversations ?? null),
      },
      status: statuses,
      note: 'Counts are conversations by channel, not emails, SMS messages, or calls sent. Message direction and response time are not stored.',
    };
  }

  async trends(tenantId: string, query: { range?: string; from?: string; to?: string }, scopeUserId?: string) {
    this.assertTenant(tenantId);
    const windows = this.windows(query);
    const [leads, prospects, proposals, tasksCreated, tasksCompleted, conversations] = await Promise.all([
      scopeUserId ? Promise.resolve([]) : this.analytics.createdTrend(tenantId, 'leads', windows.current),
      scopeUserId ? Promise.resolve([]) : this.analytics.createdTrend(tenantId, 'prospects', windows.current),
      scopeUserId ? Promise.resolve([]) : this.analytics.createdTrend(tenantId, 'proposals', windows.current),
      this.analytics.createdTrend(tenantId, 'tasks', windows.current, false, scopeUserId),
      this.analytics.createdTrend(tenantId, 'tasks', windows.current, true, scopeUserId),
      scopeUserId ? Promise.resolve([]) : this.analytics.createdTrend(tenantId, 'conversations', windows.current),
    ]);
    return {
      window: this.serialize(windows.current),
      leads,
      prospects,
      proposals,
      tasksCreated,
      tasksCompleted,
      conversations,
      note: 'Each point is a UTC day inside the selected period. Days with no rows are omitted rather than filled with invented zeros.',
    };
  }

  async insights(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const [sales, proposals, tasks, team] = await Promise.all([
      this.sales(tenantId, query),
      this.proposals(tenantId, query),
      this.tasks(tenantId, query),
      this.team(tenantId, query),
    ]);
    const ranked = [...team.members].sort((left, right) => right.open - left.open || left.name.localeCompare(right.name));
    const insights = buildInsights({
      evidencePeriod: windowLabel(this.windows(query).current),
      hasComparison: sales.previousWindow !== null,
      leads: sales.comparisons.leads,
      acceptedProposals: proposals.comparisons.accepted,
      overdueTasks: tasks.comparisons.overdue,
      leadConversion: sales.leadToProspect,
      acceptance: proposals.acceptanceRate,
      busiestMember: ranked[0]
        ? { name: ranked[0].name, openTasks: ranked[0].open, nextOpenTasks: ranked[1]?.open ?? null }
        : null,
    });
    return {
      window: sales.window,
      previousWindow: sales.previousWindow,
      insights,
      factsAreCalculated: true,
      geminiMayNotInventMetrics: true,
    };
  }

  async salesSummary(tenantId: string, message: string) {
    const query = windowFromMessage(message);
    const sales = await this.sales(tenantId, query);
    return { summary: this.salesText(sales) };
  }

  async proposalSummary(tenantId: string, message: string) {
    const proposals = await this.proposals(tenantId, windowFromMessage(message));
    return { summary: this.proposalText(proposals) };
  }

  async scopedTaskSummary(tenantId: string, message: string, userId: string) {
    const tasks = await this.tasks(tenantId, windowFromMessage(message), userId);
    return { summary: this.taskText(tasks) };
  }

  async taskSummary(tenantId: string, message: string) {
    const [tasks, team] = await Promise.all([
      this.tasks(tenantId, windowFromMessage(message)),
      this.team(tenantId, windowFromMessage(message)),
    ]);
    return { summary: `${this.taskText(tasks)}\n${this.teamText(team)}` };
  }

  async overviewSummary(tenantId: string, message: string) {
    const query = windowFromMessage(message);
    const [overview, insightResult] = await Promise.all([
      this.overview(tenantId, query),
      this.insights(tenantId, query),
    ]);
    const lines = [
      `Business summary ${overview.window.from} to ${overview.window.to} UTC.`,
      `New companies ${overview.currentPeriod.companies} (previous ${overview.previousPeriod?.companies ?? 0}).`,
      `New leads ${overview.currentPeriod.leads} (previous ${overview.previousPeriod?.leads ?? 0}).`,
      `Proposals accepted ${overview.currentPeriod.acceptedProposals} (previous ${overview.previousPeriod?.acceptedProposals ?? 0}).`,
      `Tasks completed ${overview.currentPeriod.completedTasks} (previous ${overview.previousPeriod?.completedTasks ?? 0}).`,
      `Overdue tasks in the period ${overview.currentPeriod.overdueTasks} (previous ${overview.previousPeriod?.overdueTasks ?? 0}).`,
      'Lifetime totals are separate and are not used as the trend.',
      ...insightResult.insights.slice(0, 4).map((item) => `${item.kind === 'recommendation' ? 'Recommendation' : 'Fact'}: ${item.title}. ${item.description}`),
    ];
    return { summary: lines.join('\n') };
  }

  private salesText(sales: Awaited<ReturnType<AnalyticsService['sales']>>): string {
    return [
      `Sales for ${sales.window.from} to ${sales.window.to} UTC.`,
      `Companies ${sales.pipeline.companies}, leads ${sales.pipeline.leads}, prospects ${sales.pipeline.prospects}, proposals ${sales.pipeline.proposals}.`,
      this.rateText('Lead-to-prospect', sales.leadToProspect),
      `Previous period leads ${sales.comparisons.leads.previous ?? 'unavailable'}.`,
      sales.note,
    ].join('\n');
  }

  private proposalText(proposals: Awaited<ReturnType<AnalyticsService['proposals']>>): string {
    return [
      `Proposals accepted in the period: ${proposals.currentStatusEvents.accepted}. Sent: ${proposals.currentStatusEvents.sent}.`,
      this.rateText('Acceptance', proposals.acceptanceRate),
      proposals.averageSentToAcceptedHours === null
        ? 'Average time from sent to accepted is unavailable because no proposal has both sentAt and acceptedAt in this period.'
        : `Average time from sent to accepted is ${proposals.averageSentToAcceptedHours} hours.`,
      proposals.note,
    ].join('\n');
  }

  private taskText(tasks: Awaited<ReturnType<AnalyticsService['tasks']>>): string {
    return [
      `Task snapshot: pending ${tasks.status.pending}, in progress ${tasks.status.inProgress}, completed ${tasks.status.completed}, cancelled ${tasks.status.cancelled}, overdue ${tasks.status.overdue}.`,
      this.rateText('Completion', tasks.completionRate),
      `Completed in the period ${tasks.comparisons.completed.current}; previous ${tasks.comparisons.completed.previous ?? 'unavailable'}.`,
      tasks.note,
    ].join('\n');
  }

  private teamText(workload: Awaited<ReturnType<AnalyticsService['team']>>): string {
    if (!workload.members.length) return 'No active team members.';
    const lines = workload.members.slice(0, 8).map((member) => `${member.name}: ${member.open} open, ${member.completed} completed, ${member.overdue} overdue.`);
    return ['Team workload uses open task counts, not working hours.', ...lines].join('\n');
  }

  private rateText(label: string, value: AnalyticsRate): string {
    return value.percent === null
      ? `${label} rate is unavailable because the denominator is 0. ${value.definition}`
      : `${label} rate is ${value.percent}% (${value.numerator} of ${value.denominator}). ${value.definition}`;
  }

  private windows(query: { range?: string; from?: string; to?: string }): { current: DashboardWindow; previous: DashboardWindow | null } {
    const current = resolveAnalyticsWindow(query);
    return { current, previous: previousWindow(current) };
  }

  private serialize(window: DashboardWindow) {
    return {
      preset: window.preset,
      from: window.from?.toISOString() ?? null,
      to: window.to?.toISOString() ?? null,
      timezone: window.timezone,
    };
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
  }
}

export type { AnalyticsInsight, AnalyticsComparison };
