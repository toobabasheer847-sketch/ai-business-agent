import { Injectable, UnauthorizedException } from '@nestjs/common';

import { resolveDashboardWindow, type DashboardWindow } from './dashboard-range.js';
import { DashboardRepository } from './dashboard.repository.js';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  overview(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    const window = this.windowFor(tenantId, query);
    return this.withLifetimeAndFiltered(window, (mode) =>
      this.dashboardRepository.overviewCounts(tenantId, window, mode),
    );
  }

  salesPipeline(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    const window = this.windowFor(tenantId, query);
    return this.withLifetimeAndFiltered(window, (mode) =>
      this.dashboardRepository.pipelineCounts(tenantId, window, mode),
    );
  }

  async tasksSummary(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    const window = this.windowFor(tenantId, query);
    const current = await this.dashboardRepository.taskSnapshot(tenantId);
    const filtered = window.preset === 'lifetime'
      ? null
      : await this.dashboardRepository.filteredTaskCounts(tenantId, window);
    return { window: this.serializeWindow(window), current, filtered };
  }

  async recentActivity(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    const window = this.windowFor(tenantId, query);
    const items = await this.dashboardRepository.recentActivity(tenantId, window);
    return { window: this.serializeWindow(window), items };
  }

  async communicationsSummary(tenantId: string, query: { range?: string; from?: string; to?: string }) {
    const window = this.windowFor(tenantId, query);
    const [lifetime, filtered, recent] = await Promise.all([
      this.dashboardRepository.communicationCounts(tenantId, window, 'lifetime'),
      window.preset === 'lifetime'
        ? Promise.resolve(null)
        : this.dashboardRepository.communicationCounts(tenantId, window, 'filtered'),
      this.dashboardRepository.recentCommunications(tenantId, window),
    ]);
    return { window: this.serializeWindow(window), lifetime, filtered, recent };
  }

  private windowFor(tenantId: string, query: { range?: string; from?: string; to?: string }): DashboardWindow {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return resolveDashboardWindow(query);
  }

  private async withLifetimeAndFiltered<T>(
    window: DashboardWindow,
    load: (mode: 'lifetime' | 'filtered') => Promise<T>,
  ) {
    const [lifetime, filtered] = await Promise.all([
      load('lifetime'),
      window.preset === 'lifetime' ? Promise.resolve(null) : load('filtered'),
    ]);
    return { window: this.serializeWindow(window), lifetime, filtered };
  }

  private serializeWindow(window: DashboardWindow) {
    return {
      preset: window.preset,
      from: window.from?.toISOString() ?? null,
      to: window.to?.toISOString() ?? null,
      timezone: window.timezone,
    };
  }
}
