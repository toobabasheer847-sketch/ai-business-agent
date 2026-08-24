import { buildTasksListHref } from './task-drilldown';

describe('task drill-down hrefs', () => {
  it('builds existing /tasks filter URLs without inventing CRM detail routes', () => {
    expect(buildTasksListHref({ overdue: true })).toBe('/tasks?overdue=true');
    expect(buildTasksListHref({ status: 'pending' })).toBe('/tasks?status=pending');
    expect(buildTasksListHref({ status: 'completed' })).toBe(
      '/tasks?status=completed',
    );
    expect(buildTasksListHref({ priority: 'high' })).toBe(
      '/tasks?priority=high',
    );
    expect(
      buildTasksListHref({
        companyId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe('/tasks?companyId=11111111-1111-4111-8111-111111111111');
    expect(
      buildTasksListHref({
        prospectId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toBe('/tasks?prospectId=22222222-2222-4222-8222-222222222222');
    expect(
      buildTasksListHref({
        leadId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe('/tasks?leadId=33333333-3333-4333-8333-333333333333');
    expect(
      buildTasksListHref({
        assigneeId: '44444444-4444-4444-8444-444444444444',
      }),
    ).toBe('/tasks?assigneeId=44444444-4444-4444-8444-444444444444');
    expect(buildTasksListHref({ hasReminder: true })).toBe(
      '/tasks?hasReminder=true',
    );
    expect(buildTasksListHref()).toBe('/tasks');
  });
});
