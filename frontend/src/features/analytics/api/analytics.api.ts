import { apiClient } from '@/lib/api'
import type {
  AnalyticsQuery,
  CommunicationAnalytics,
  InsightAnalytics,
  ProposalAnalytics,
  SalesAnalytics,
  TaskAnalytics,
  TeamAnalytics,
  TrendAnalytics,
} from '@/features/analytics/types/analytics.types'

function params(query: AnalyticsQuery) {
  return {
    range: query.range,
    from: query.from,
    to: query.to,
  }
}

export const analyticsApi = {
  sales: async (query: AnalyticsQuery) => (await apiClient.get<SalesAnalytics>('/analytics/sales', { params: params(query) })).data,
  proposals: async (query: AnalyticsQuery) => (await apiClient.get<ProposalAnalytics>('/analytics/proposals', { params: params(query) })).data,
  tasks: async (query: AnalyticsQuery) => (await apiClient.get<TaskAnalytics>('/analytics/tasks', { params: params(query) })).data,
  team: async (query: AnalyticsQuery) => (await apiClient.get<TeamAnalytics>('/analytics/team', { params: params(query) })).data,
  communications: async (query: AnalyticsQuery) => (await apiClient.get<CommunicationAnalytics>('/analytics/communications', { params: params(query) })).data,
  trends: async (query: AnalyticsQuery) => (await apiClient.get<TrendAnalytics>('/analytics/trends', { params: params(query) })).data,
  insights: async (query: AnalyticsQuery) => (await apiClient.get<InsightAnalytics>('/analytics/insights', { params: params(query) })).data,
}
