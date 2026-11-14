import { UnauthorizedException } from '@nestjs/common';

import { AnalyticsService } from './analytics.service';

const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const counts = {
  companies: 2,
  leads: 4,
  prospects: 1,
  proposals: 1,
  draftProposals: 1,
  generatedProposals: 0,
  sentProposals: 1,
  viewedProposals: 0,
  acceptedProposals: 1,
  rejectedProposals: 0,
  pendingTasks: 3,
  completedTasks: 2,
  overdueTasks: 1,
};

describe('AnalyticsService', () => {
  const dashboard = {
    overviewCounts: jest.fn(),
    pipelineCounts: jest.fn(),
    taskSnapshot: jest.fn(),
    filteredTaskCounts: jest.fn(),
    communicationCounts: jest.fn(),
  };
  const analytics = {
    leadConversion: jest.fn(),
    statusCounts: jest.fn(),
    proposalTiming: jest.fn(),
    taskStatus: jest.fn(),
    createdTrend: jest.fn(),
  };
  const team = { getEmployeeWorkload: jest.fn(), getUpcomingDeadlines: jest.fn() };
  const service = new AnalyticsService(dashboard as never, analytics as never, team as never);

  beforeEach(() => {
    jest.clearAllMocks();
    dashboard.overviewCounts.mockImplementation((_tenant: string, _window: unknown, mode: string) =>
      Promise.resolve(mode === 'lifetime' ? { ...counts, companies: 9 } : counts),
    );
    dashboard.pipelineCounts.mockResolvedValue({
      companies: 2,
      leads: 4,
      prospects: 1,
      proposals: 1,
      companiesWithLeads: 1,
      leadsWithProspects: 1,
      prospectsWithProposals: 1,
    });
    dashboard.taskSnapshot.mockResolvedValue({ pending: 3, completed: 2, overdue: 1, dueToday: 0, dueThisWeek: 1 });
    dashboard.filteredTaskCounts.mockResolvedValue({ pending: 3, completed: 2, overdue: 1 });
    dashboard.communicationCounts.mockResolvedValue({
      totalConversations: 3,
      emailConversations: 2,
      smsConversations: 0,
      callConversations: 1,
      webConversations: 0,
    });
    analytics.leadConversion.mockResolvedValue({ leads: 4, withProspect: 1 });
    analytics.statusCounts.mockResolvedValue([{ status: 'new', count: 4 }]);
    analytics.proposalTiming.mockResolvedValue({
      expired: 0,
      cancelled: 0,
      sentPopulation: 2,
      accepted: 1,
      averageSentToAcceptedHours: 12,
    });
    analytics.taskStatus.mockResolvedValue({
      assigned: 6,
      pending: 3,
      inProgress: 1,
      completed: 2,
      cancelled: 0,
      overdue: 1,
      createdInPeriod: 4,
    });
    analytics.createdTrend.mockResolvedValue([{ day: '2026-11-14', count: 1 }]);
    team.getEmployeeWorkload.mockResolvedValue([
      { employeeId: '1', employeeName: 'Sarah', pending: 3, inProgress: 1, completed: 2, cancelled: 0, overdue: 1, upcoming: 0 },
    ]);
    team.getUpcomingDeadlines.mockResolvedValue([]);
  });

  it('rejects a missing tenant before reading analytics', async () => {
    await expect(service.sales(' ', { range: '30d' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dashboard.pipelineCounts).not.toHaveBeenCalled();
  });

  it('keeps lifetime totals separate and compares the filtered period', async () => {
    const overview = await service.overview(tenantA, { range: '30d' });
    expect(overview.lifetimeLabeled.companies).toBe(9);
    expect(overview.currentPeriod.companies).toBe(2);
    expect(overview.comparisons.leads.current).toBe(4);
    expect(overview.comparisons.leads.previous).toBe(4);
    expect(overview.unsupported).toContain('revenue');
    expect(dashboard.overviewCounts).toHaveBeenCalledWith(tenantA, expect.any(Object), 'lifetime');
  });

  it('calculates lead conversion and proposal acceptance from the returned populations', async () => {
    const sales = await service.sales(tenantA, { range: '7d' });
    const proposals = await service.proposals(tenantA, { range: '7d' });
    const tasks = await service.tasks(tenantA, { range: '7d' });
    expect(sales.leadToProspect).toMatchObject({ numerator: 1, denominator: 4, percent: 25 });
    expect(proposals.acceptanceRate.percent).toBe(50);
    expect(proposals.currentStatusEvents.draft).toBe(1);
    expect(tasks.completionRate).toMatchObject({ numerator: 2, denominator: 6, percent: 33.3 });
    expect(tasks.status.cancelled).toBe(0);
  });

  it('does not reuse one tenant result for another tenant', async () => {
    await service.communications(tenantA, { range: '30d' });
    await service.communications(tenantB, { range: '30d' });
    expect(dashboard.communicationCounts).toHaveBeenNthCalledWith(1, tenantA, expect.any(Object), 'filtered');
    expect(dashboard.communicationCounts).toHaveBeenNthCalledWith(3, tenantB, expect.any(Object), 'filtered');
  });

  it('returns an empty-safe team workload and conversation counts', async () => {
    team.getEmployeeWorkload.mockResolvedValue([]);
    const teamResult = await service.team(tenantA, { range: '30d' });
    const communications = await service.communications(tenantA, { range: '30d' });
    expect(teamResult.members).toEqual([]);
    expect(communications.conversations.emailConversations).toBe(2);
    expect(communications.note).toContain('not emails');
  });
});
