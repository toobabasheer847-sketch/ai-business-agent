import { UnauthorizedException } from '@nestjs/common';

import { TeamAnalyticsService } from './team-analytics.service';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const sarah = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  employeeName: 'Sarah',
  email: 'sarah@example.com',
  assigned: 12,
  pending: 5,
  inProgress: 4,
  completed: 2,
  cancelled: 1,
  overdue: 3,
  upcoming: 1,
};

const sam = {
  employeeId: '22222222-2222-4222-8222-222222222222',
  employeeName: 'Sam',
  email: 'sam@example.com',
  assigned: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  overdue: 0,
  upcoming: 0,
};

describe('TeamAnalyticsService', () => {
  const repository = {
    employeeWorkload: jest.fn(),
    unassignedCounts: jest.fn(),
    deadlines: jest.fn(),
    recentTaskUpdates: jest.fn(),
  };
  const service = new TeamAnalyticsService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.employeeWorkload.mockResolvedValue([sam, sarah]);
    repository.unassignedCounts.mockResolvedValue({
      assigned: 2,
      pending: 2,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 1,
      upcoming: 0,
    });
    repository.recentTaskUpdates.mockResolvedValue([]);
    repository.deadlines.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Call Harbor',
        status: 'pending',
        dueAt: '2026-11-01T00:00:00.000Z',
        assigneeId: sarah.employeeId,
        assigneeName: 'Sarah',
      },
    ]);
  });

  it('requires a tenant before reading employees', async () => {
    await expect(service.getTeamOverview(' ')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.employeeWorkload).not.toHaveBeenCalled();
  });

  it('loads members, unassigned counts, and recent updates in one overview', async () => {
    const overview = await service.getTeamOverview(tenantId);

    expect(repository.employeeWorkload).toHaveBeenCalledWith(tenantId);
    expect(repository.unassignedCounts).toHaveBeenCalledWith(tenantId);
    expect(overview.activeMembers).toBe(2);
    expect(overview.employees.map((employee) => employee.employeeName)).toEqual(['Sam', 'Sarah']);
    expect(overview.unassigned.overdue).toBe(1);
  });

  it('keeps employees with no tasks and ranks overdue assignees', async () => {
    const overdue = await service.getOverdueTasksByEmployee(tenantId);

    expect(overdue.employees).toEqual([sarah]);
    expect(overdue.tasks).toHaveLength(1);
    expect(repository.deadlines).toHaveBeenCalledWith(tenantId, 'overdue');
  });

  it('ranks completion without treating zero-task employees as missing', async () => {
    const ranked = await service.getTaskCompletionSummary(tenantId);

    expect(ranked.map((employee) => employee.employeeName)).toEqual(['Sarah', 'Sam']);
    expect(ranked[1].completed).toBe(0);
  });

  it('reports that project progress is not stored', () => {
    expect(service.getProjectProgress()).toEqual({
      supported: false,
      reason: 'Projects are not stored. There is no project status to calculate. Task progress is available by assignee.',
    });
  });
});
