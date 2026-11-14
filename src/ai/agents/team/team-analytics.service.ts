import { Injectable, UnauthorizedException } from '@nestjs/common';

import {
  TeamAnalyticsRepository,
  type EmployeeWorkloadRow,
  type TeamActivityRow,
  type TeamDeadlineRow,
  type UnassignedTaskCounts,
} from './team-analytics.repository.js';

export type TeamOverview = {
  activeMembers: number;
  employees: EmployeeWorkloadRow[];
  unassigned: UnassignedTaskCounts;
  recent: TeamActivityRow[];
};

export type ProjectProgress = {
  supported: false;
  reason: string;
};

@Injectable()
export class TeamAnalyticsService {
  constructor(private readonly repository: TeamAnalyticsRepository) {}

  async getTeamOverview(tenantId: string): Promise<TeamOverview> {
    this.assertTenant(tenantId);
    const [employees, unassigned, recent] = await Promise.all([
      this.repository.employeeWorkload(tenantId),
      this.repository.unassignedCounts(tenantId),
      this.repository.recentTaskUpdates(tenantId),
    ]);
    return { activeMembers: employees.length, employees, unassigned, recent };
  }

  async getTeamMembers(tenantId: string): Promise<EmployeeWorkloadRow[]> {
    this.assertTenant(tenantId);
    return this.repository.employeeWorkload(tenantId);
  }

  async getEmployeeWorkload(tenantId: string): Promise<EmployeeWorkloadRow[]> {
    return this.getTeamMembers(tenantId);
  }

  async getOverdueTasksByEmployee(tenantId: string): Promise<{
    employees: EmployeeWorkloadRow[];
    tasks: TeamDeadlineRow[];
  }> {
    this.assertTenant(tenantId);
    const [employees, tasks] = await Promise.all([
      this.repository.employeeWorkload(tenantId),
      this.repository.deadlines(tenantId, 'overdue'),
    ]);
    return {
      employees: employees.filter((employee) => employee.overdue > 0),
      tasks,
    };
  }

  async getTaskDistribution(tenantId: string): Promise<EmployeeWorkloadRow[]> {
    return this.getEmployeeWorkload(tenantId);
  }

  async getTaskCompletionSummary(tenantId: string): Promise<EmployeeWorkloadRow[]> {
    const employees = await this.getEmployeeWorkload(tenantId);
    return [...employees].sort((left, right) => right.completed - left.completed || left.employeeName.localeCompare(right.employeeName));
  }

  async getUpcomingDeadlines(tenantId: string): Promise<TeamDeadlineRow[]> {
    this.assertTenant(tenantId);
    return this.repository.deadlines(tenantId, 'upcoming');
  }

  getProjectProgress(): ProjectProgress {
    return {
      supported: false,
      reason: 'Projects are not stored. There is no project status to calculate. Task progress is available by assignee.',
    };
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
  }
}
