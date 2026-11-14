import { UnauthorizedException } from '@nestjs/common';

import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const zeros = {
    companies: 0,
    leads: 0,
    prospects: 0,
    proposals: 0,
    draftProposals: 0,
    generatedProposals: 0,
    sentProposals: 0,
    viewedProposals: 0,
    acceptedProposals: 0,
    rejectedProposals: 0,
    pendingTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
  };

  const repository = {
    overviewCounts: jest.fn(),
    pipelineCounts: jest.fn(),
    taskSnapshot: jest.fn(),
    filteredTaskCounts: jest.fn(),
    recentActivity: jest.fn(),
    communicationCounts: jest.fn(),
    recentCommunications: jest.fn(),
  };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.overviewCounts.mockImplementation(async () => ({ ...zeros }));
    repository.pipelineCounts.mockResolvedValue({
      companies: 0,
      leads: 0,
      prospects: 0,
      proposals: 0,
      companiesWithLeads: 0,
      leadsWithProspects: 0,
      prospectsWithProposals: 0,
    });
    repository.taskSnapshot.mockResolvedValue({
      pending: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
    });
    repository.filteredTaskCounts.mockResolvedValue({ pending: 0, completed: 0, overdue: 0 });
    repository.recentActivity.mockResolvedValue([]);
    repository.communicationCounts.mockResolvedValue({
      totalConversations: 0,
      emailConversations: 0,
      smsConversations: 0,
      callConversations: 0,
      webConversations: 0,
    });
    repository.recentCommunications.mockResolvedValue([]);
    service = new DashboardService(repository as any);
  });

  it('returns zero KPIs for an empty tenant and keeps filtered null on lifetime', async () => {
    const overview = await service.overview(tenantA, {});
    expect(overview.lifetime).toEqual(zeros);
    expect(overview.filtered).toBeNull();
    expect(overview.window.preset).toBe('lifetime');
    expect(repository.overviewCounts).toHaveBeenCalledWith(tenantA, expect.any(Object), 'lifetime');
    expect(repository.overviewCounts).not.toHaveBeenCalledWith(tenantB, expect.anything(), expect.anything());
  });

  it('asks for a filtered snapshot only when a date range is set', async () => {
    repository.overviewCounts.mockImplementation(async (_tenant: string, _window: unknown, mode: string) => ({
      ...zeros,
      companies: mode === 'filtered' ? 2 : 9,
      sentProposals: mode === 'filtered' ? 1 : 4,
      pendingTasks: mode === 'filtered' ? 3 : 5,
      completedTasks: 6,
      overdueTasks: mode === 'filtered' ? 1 : 2,
    }));

    const overview = await service.overview(tenantA, { range: '7d' });
    expect(overview.window.preset).toBe('7d');
    expect(overview.window.timezone).toBe('UTC');
    expect(overview.lifetime.companies).toBe(9);
    expect(overview.filtered?.companies).toBe(2);
    expect(overview.filtered?.sentProposals).toBe(1);
    expect(overview.lifetime.overdueTasks).toBe(2);
  });

  it('keeps due today and this week on the current snapshot, not the date filter', async () => {
    repository.taskSnapshot.mockResolvedValue({
      pending: 4,
      completed: 8,
      overdue: 1,
      dueToday: 2,
      dueThisWeek: 3,
    });
    repository.filteredTaskCounts.mockResolvedValue({ pending: 1, completed: 1, overdue: 0 });

    const summary = await service.tasksSummary(tenantA, { range: '30d' });
    expect(summary.current.dueToday).toBe(2);
    expect(summary.current.dueThisWeek).toBe(3);
    expect(summary.filtered).toEqual({ pending: 1, completed: 1, overdue: 0 });
    expect(repository.taskSnapshot).toHaveBeenCalledWith(tenantA);
  });

  it('returns activity and communication rows only for the authenticated tenant', async () => {
    repository.recentActivity.mockResolvedValue([
      { id: 'p1', kind: 'proposal.sent', title: 'Harbor', occurredAt: '2026-11-14T00:00:00.000Z' },
    ]);
    repository.communicationCounts.mockImplementation(async (_tenant: string, _window: unknown, mode: string) => ({
      totalConversations: mode === 'filtered' ? 1 : 4,
      emailConversations: mode === 'filtered' ? 1 : 2,
      smsConversations: 1,
      callConversations: 1,
      webConversations: 0,
    }));
    repository.recentCommunications.mockResolvedValue([
      { id: 'c1', channel: 'email', title: 'Follow up', status: 'active', updatedAt: '2026-11-14T00:00:00.000Z' },
    ]);

    const activity = await service.recentActivity(tenantA, { range: '90d' });
    const communications = await service.communicationsSummary(tenantA, { range: '90d' });

    expect(activity.items).toHaveLength(1);
    expect(activity.items[0].kind).toBe('proposal.sent');
    expect(communications.lifetime.emailConversations).toBe(2);
    expect(communications.filtered?.emailConversations).toBe(1);
    expect(communications.recent[0].channel).toBe('email');
    expect(repository.recentActivity).toHaveBeenCalledWith(tenantA, expect.any(Object));
    expect(repository.communicationCounts).not.toHaveBeenCalledWith(tenantB, expect.anything(), expect.anything());
  });

  it('rejects a missing tenant instead of aggregating globally', () => {
    expect(() => service.overview('', {})).toThrow(UnauthorizedException);
    expect(repository.overviewCounts).not.toHaveBeenCalled();
  });
});
