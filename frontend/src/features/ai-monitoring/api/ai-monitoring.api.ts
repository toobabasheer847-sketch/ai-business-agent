import { apiClient } from '@/lib/api'
import type { AgentRun, AgentRunPage, MonitoringFilters, MonitoringSummary } from '@/features/ai-monitoring/types/ai-monitoring.types'

function params(filters: MonitoringFilters) {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    agent: filters.agent || undefined,
    provider: filters.provider || undefined,
    model: filters.model || undefined,
    status: filters.status || undefined,
    page: filters.page,
    limit: 20,
    sort: 'startedAt',
    direction: 'desc',
  }
}

export const aiMonitoringApi = {
  summary: async (filters: MonitoringFilters) => (await apiClient.get<MonitoringSummary>('/ai-monitoring/summary', { params: params(filters) })).data,
  runs: async (filters: MonitoringFilters) => (await apiClient.get<AgentRunPage>('/ai-monitoring/runs', { params: params(filters) })).data,
  run: async (id: string) => (await apiClient.get<AgentRun>(`/ai-monitoring/runs/${id}`)).data,
}
