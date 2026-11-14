import { UnauthorizedException } from '@nestjs/common';

import { TeamAgent } from './team-agent';

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
  assigned: 1,
  pending: 1,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  overdue: 0,
  upcoming: 0,
};

describe('TeamAgent', () => {
  const analytics = {
    getTeamOverview: jest.fn(),
    getTeamMembers: jest.fn(),
    getEmployeeWorkload: jest.fn(),
    getOverdueTasksByEmployee: jest.fn(),
    getTaskDistribution: jest.fn(),
    getTaskCompletionSummary: jest.fn(),
    getUpcomingDeadlines: jest.fn(),
    getProjectProgress: jest.fn(),
  };
  const agent = new TeamAgent(analytics as never);

  beforeEach(() => {
    jest.clearAllMocks();
    analytics.getTeamMembers.mockResolvedValue([sam, sarah]);
    analytics.getEmployeeWorkload.mockResolvedValue([sam, sarah]);
    analytics.getTaskDistribution.mockResolvedValue([sam, sarah]);
    analytics.getTaskCompletionSummary.mockResolvedValue([sarah, sam]);
    analytics.getOverdueTasksByEmployee.mockResolvedValue({ employees: [sarah], tasks: [] });
    analytics.getUpcomingDeadlines.mockResolvedValue([]);
    analytics.getProjectProgress.mockReturnValue({
      supported: false,
      reason: 'Projects are not stored. There is no project status to calculate. Task progress is available by assignee.',
    });
    analytics.getTeamOverview.mockResolvedValue({
      activeMembers: 2,
      employees: [sam, sarah],
      unassigned: {
        assigned: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        overdue: 0,
        upcoming: 0,
      },
      recent: [],
    });
  });

  it('rejects an empty tenant before reading analytics', async () => {
    await expect(agent.answer('', 'Show me my team overview.')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(analytics.getTeamOverview).not.toHaveBeenCalled();
  });

  it('counts active users as the organization', async () => {
    const result = await agent.answer(tenantId, 'How many employees are in my organization?');

    expect(result.focus).toBe('members');
    expect(result.summary).toContain('2 active team members');
    expect(result.summary).toContain('Sarah');
    expect(result.summary).not.toContain('performance');
  });

  it('names the employee with the most pending tasks from the counts', async () => {
    const result = await agent.answer(tenantId, 'Who has the most pending tasks?');

    expect(result.summary).toContain('Sarah has the most pending tasks (5)');
    expect(result.summary).toContain('5 pending');
    expect(result.summary).toContain('4 in progress');
    expect(result.summary).toContain('Working hours, attendance, and availability are not stored');
  });

  it('suggests the lighter open-task count without assigning the task', async () => {
    const result = await agent.answer(tenantId, 'Which team member should receive this task?');

    expect(result.summary).toContain('Sam');
    expect(result.summary).toContain('The task was not created or assigned.');
    expect(result.summary).toContain('not a measure of capacity in hours');
  });

  it('does not invent project progress', async () => {
    const result = await agent.answer(tenantId, 'Which projects are delayed?');

    expect(result.focus).toBe('projects');
    expect(result.summary).toContain('Projects are not stored');
    expect(analytics.getEmployeeWorkload).not.toHaveBeenCalled();
  });

  it('says when no deadlines are inside the next seven days', async () => {
    const result = await agent.answer(tenantId, 'Which tasks are approaching their deadlines?');

    expect(result.summary).toContain('next 7 days (UTC)');
  });
});
