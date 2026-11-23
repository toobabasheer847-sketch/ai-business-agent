import { apiClient } from '@/lib/api'
import type {
  WorkflowAnalyticsDetail,
  WorkflowAnalyticsOverview,
  WorkflowFailureReport,
  WorkflowPerformance,
  WorkflowRecommendation,
  WorkflowTrendDay,
} from '@/features/workflow-analytics/types/workflow-analytics.types'

export type AnalyticsParams = {
  range?: string
  from?: string
  to?: string
  workflowStatus?: string
  executionStatus?: string
  triggerType?: string
  page?: number
}

export const workflowAnalyticsApi = {
  overview: async (params: AnalyticsParams) =>
    (await apiClient.get<WorkflowAnalyticsOverview>('/workflow-analytics/overview', { params })).data,
  trends: async (params: AnalyticsParams) =>
    (await apiClient.get<{ days: WorkflowTrendDay[] }>('/workflow-analytics/trends', { params })).data,
  workflows: async (params: AnalyticsParams) =>
    (await apiClient.get<{ data: WorkflowPerformance[]; total: number }>('/workflow-analytics/workflows', { params })).data,
  workflow: async (id: string, params: AnalyticsParams) =>
    (await apiClient.get<WorkflowAnalyticsDetail>(`/workflow-analytics/workflows/${id}`, { params })).data,
  failures: async (params: AnalyticsParams) =>
    (await apiClient.get<WorkflowFailureReport>('/workflow-analytics/failures', { params })).data,
  optimizations: async (params: AnalyticsParams) =>
    (await apiClient.get<{ data: WorkflowRecommendation[] }>('/workflow-analytics/optimizations', { params })).data,
  updateStatus: async (id: string, status: string) =>
    (await apiClient.patch<{ id: string; status: string }>(`/workflow-analytics/optimizations/${id}/status`, { status })).data,
}
