import { Injectable, UnauthorizedException } from '@nestjs/common';

import { detectTeamFocus, type TeamFocus } from './team-intent.js';
import { TEAM_UPCOMING_DAYS } from './team-analytics.repository.js';
import {
  TeamAnalyticsService,
  type TeamOverview,
} from './team-analytics.service.js';
import type { EmployeeWorkloadRow, TeamDeadlineRow } from './team-analytics.repository.js';

const COUNT_BASIS =
  'Workload comparisons use assigned task counts and statuses. Working hours, attendance, and availability are not stored, so this is not a measure of capacity in hours or of employee performance.';

export type TeamAnalysis = {
  focus: TeamFocus;
  summary: string;
  activeMembers: number;
};

@Injectable()
export class TeamAgent {
  constructor(private readonly analytics: TeamAnalyticsService) {}

  async answer(tenantId: string, message: string): Promise<TeamAnalysis> {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
    const focus = detectTeamFocus(message);
    if (focus === 'projects') {
      const progress = this.analytics.getProjectProgress();
      return { focus, summary: progress.reason, activeMembers: 0 };
    }
    if (focus === 'members') {
      const members = await this.analytics.getTeamMembers(tenantId);
      return { focus, summary: this.members(members), activeMembers: members.length };
    }
    if (focus === 'overdue') {
      const overdue = await this.analytics.getOverdueTasksByEmployee(tenantId);
      return {
        focus,
        summary: this.overdue(overdue.employees, overdue.tasks),
        activeMembers: overdue.employees.length,
      };
    }
    if (focus === 'deadlines') {
      const deadlines = await this.analytics.getUpcomingDeadlines(tenantId);
      return { focus, summary: this.deadlines(deadlines), activeMembers: 0 };
    }
    if (focus === 'completion') {
      const employees = await this.analytics.getTaskCompletionSummary(tenantId);
      return { focus, summary: this.completion(employees), activeMembers: employees.length };
    }
    if (focus === 'distribution' || focus === 'workload') {
      const employees = await this.analytics.getTaskDistribution(tenantId);
      return {
        focus,
        summary: focus === 'workload' ? this.mostPending(employees) : this.distribution(employees),
        activeMembers: employees.length,
      };
    }
    if (focus === 'capacity' || focus === 'assignment' || focus === 'balance') {
      const employees = await this.analytics.getEmployeeWorkload(tenantId);
      return { focus, summary: this.recommendation(employees, focus), activeMembers: employees.length };
    }

    const overview = await this.analytics.getTeamOverview(tenantId);
    return { focus, summary: this.overview(overview), activeMembers: overview.activeMembers };
  }

  private members(employees: EmployeeWorkloadRow[]): string {
    if (!employees.length) {
      return 'This organization has no active team members. Inactive users are excluded.';
    }
    const lines = employees.map((employee) => `${employee.employeeName} (${employee.email})`);
    return [
      `There ${employees.length === 1 ? 'is' : 'are'} ${employees.length} active team member${employees.length === 1 ? '' : 's'}.`,
      'Active means the user account is enabled. Calendar availability is not stored.',
      ...lines,
    ].join('\n');
  }

  private overview(overview: TeamOverview): string {
    const totals = this.totals(overview.employees);
    const lines = [
      `Team overview: ${overview.activeMembers} active member${overview.activeMembers === 1 ? '' : 's'}.`,
      `Assigned tasks: ${totals.assigned} total, ${totals.pending} pending, ${totals.inProgress} in progress, ${totals.completed} completed, ${totals.cancelled} cancelled, ${totals.overdue} overdue.`,
      `Unassigned tasks: ${overview.unassigned.assigned} total, ${overview.unassigned.pending} pending, ${overview.unassigned.inProgress} in progress, ${overview.unassigned.overdue} overdue.`,
      'Overdue means an open task (pending or in progress) whose due time is already past. Completed and cancelled tasks are not overdue.',
    ];
    if (!overview.recent.length) {
      lines.push('No task updates are recorded for this tenant.');
    } else {
      lines.push('Recent task updates:');
      for (const item of overview.recent) {
        lines.push(`- ${item.title} (${item.status}) ${item.assigneeName ?? 'Unassigned'} updated ${item.updatedAt}`);
      }
    }
    return lines.join('\n');
  }

  private mostPending(employees: EmployeeWorkloadRow[]): string {
    if (!employees.length) return 'This organization has no active team members to compare.';
    const ranked = [...employees].sort((left, right) => right.pending - left.pending || left.employeeName.localeCompare(right.employeeName));
    const top = ranked[0];
    if (top.pending === 0) {
      return 'No active team member has pending tasks.';
    }
    const tied = ranked.filter((employee) => employee.pending === top.pending);
    const names = tied.map((employee) => employee.employeeName).join(', ');
    return [
      `${names} ${tied.length === 1 ? 'has' : 'have'} the most pending tasks (${top.pending}).`,
      ...tied.map((employee) => this.employeeLine(employee)),
      COUNT_BASIS,
    ].join('\n');
  }

  private distribution(employees: EmployeeWorkloadRow[]): string {
    if (!employees.length) return 'This organization has no active team members, so there is no task distribution.';
    return [
      'Task distribution across active team members:',
      ...employees.map((employee) => this.employeeLine(employee)),
      'Employees with no assigned tasks are included with zero counts.',
      'Overdue tasks are already included in pending or in progress and are not added again.',
      COUNT_BASIS,
    ].join('\n');
  }

  private overdue(employees: EmployeeWorkloadRow[], tasks: TeamDeadlineRow[]): string {
    if (!employees.length && !tasks.length) {
      return 'No active team member has an overdue task, and there are no overdue open tasks in this tenant.';
    }
    const lines = ['Overdue open tasks by active team member:'];
    if (!employees.length) {
      lines.push('No active assignee has an overdue task.');
    } else {
      for (const employee of [...employees].sort((left, right) => right.overdue - left.overdue || left.employeeName.localeCompare(right.employeeName))) {
        lines.push(`${employee.employeeName}: ${employee.overdue} overdue, ${employee.pending} pending, ${employee.inProgress} in progress.`);
      }
    }
    if (tasks.length) {
      lines.push('Overdue task records:');
      for (const task of tasks) {
        lines.push(`- ${task.title} due ${task.dueAt} (${task.status}) ${this.assigneeLabel(task)}`);
      }
    }
    lines.push('Completed and cancelled tasks are excluded from overdue.');
    return lines.join('\n');
  }

  private deadlines(tasks: TeamDeadlineRow[]): string {
    if (!tasks.length) {
      return `No open tasks are due in the next ${TEAM_UPCOMING_DAYS} days (UTC).`;
    }
    return [
      `Open tasks due in the next ${TEAM_UPCOMING_DAYS} days (UTC):`,
      ...tasks.map((task) => `- ${task.title} due ${task.dueAt} (${task.status}) ${this.assigneeLabel(task)}`),
    ].join('\n');
  }

  private completion(employees: EmployeeWorkloadRow[]): string {
    if (!employees.length) return 'This organization has no active team members.';
    const ranked = employees.filter((employee) => employee.completed > 0);
    if (!ranked.length) {
      return 'No active team member has a completed task. Completed counts are task records, not a performance or attendance score.';
    }
    return [
      'Completed tasks by active team member:',
      ...ranked.map((employee) => `${employee.employeeName}: ${employee.completed} completed.`),
      'Completed counts are task records, not a performance or attendance score.',
    ].join('\n');
  }

  private recommendation(employees: EmployeeWorkloadRow[], focus: TeamFocus): string {
    if (!employees.length) {
      return 'This organization has no active team members, so a task cannot be recommended to anyone.';
    }
    const ranked = [...employees].sort((left, right) => this.openCount(left) - this.openCount(right) || left.employeeName.localeCompare(right.employeeName));
    const lightest = ranked[0];
    const heaviest = [...ranked].sort((left, right) => this.openCount(right) - this.openCount(left) || left.employeeName.localeCompare(right.employeeName))[0];
    const tied = ranked.filter((employee) => this.openCount(employee) === this.openCount(lightest));
    const lines = [COUNT_BASIS];
    if (focus === 'balance') {
      lines.push(
        `${heaviest.employeeName} has the most open tasks (${this.openCount(heaviest)}).`,
        `${tied.map((employee) => employee.employeeName).join(', ')} ${tied.length === 1 ? 'has' : 'have'} the fewest open tasks (${this.openCount(lightest)}).`,
        'Moving new work toward the lower open-task counts is the only balance signal available.',
      );
    } else {
      lines.push(
        `${tied.map((employee) => employee.employeeName).join(', ')} ${tied.length === 1 ? 'has' : 'have'} the fewest open tasks (${this.openCount(lightest)}: ${lightest.pending} pending, ${lightest.inProgress} in progress).`,
        focus === 'assignment'
          ? 'That is the suggested assignee based on open task count. The task was not created or assigned.'
          : 'That is the suggested place for new work based on open task count.',
      );
    }
    lines.push(...ranked.map((employee) => this.employeeLine(employee)));
    return lines.join('\n');
  }

  private employeeLine(employee: EmployeeWorkloadRow): string {
    return `${employee.employeeName}: ${employee.assigned} assigned, ${employee.pending} pending, ${employee.inProgress} in progress, ${employee.completed} completed, ${employee.cancelled} cancelled, ${employee.overdue} overdue, ${employee.upcoming} due within ${TEAM_UPCOMING_DAYS} days.`;
  }

  private assigneeLabel(task: TeamDeadlineRow): string {
    if (!task.assigneeId) return 'Unassigned';
    return task.assigneeName ?? 'Inactive assignee';
  }

  private totals(employees: EmployeeWorkloadRow[]) {
    return employees.reduce(
      (sum, employee) => ({
        assigned: sum.assigned + employee.assigned,
        pending: sum.pending + employee.pending,
        inProgress: sum.inProgress + employee.inProgress,
        completed: sum.completed + employee.completed,
        cancelled: sum.cancelled + employee.cancelled,
        overdue: sum.overdue + employee.overdue,
      }),
      { assigned: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, overdue: 0 },
    );
  }

  private openCount(employee: EmployeeWorkloadRow): number {
    return employee.pending + employee.inProgress;
  }
}
