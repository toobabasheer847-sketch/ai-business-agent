import { apiClient } from '@/lib/api'

export type GrowthOpportunity = {
  id: string
  companyId: string
  companyName: string
  leadId: string | null
  prospectId: string | null
  proposalId: string | null
  opportunityType: string
  title: string
  description: string
  evidence: string
  explicit: boolean
  sourceType: string
  sourceId: string
  priority: string
  priorityRank: number
  prioritySource: string
  confidence: string
  status: string
  recommendedAction: string
  assignedTo: string | null
  taskId: string | null
  outcome: string | null
  createdAt: string
  revenue: null
  proposalValue: null
  predictiveModel: false
}

export type GrowthPlan = {
  id: string
  opportunityId: string
  objective: string
  expectedOutcome: string
  actualOutcome: string | null
  status: string
  priority: string
  dueAt: string | null
  taskId: string | null
}

export type GrowthAnalytics = {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  highPriority: number
  awaitingReview: number
  withPlans: number
  overdueLinked: number
  won: number
  lost: number
  converted: number
  insufficientLeads: number
  revenue: null
  proposalValue: null
  conversionRate: null
  method: 'heuristic'
  predictiveModel: false
  scoring: string
  note: string
  truncated: boolean
}

export const growthApi = {
  analytics: () => apiClient.get<GrowthAnalytics>('/growth-opportunities/analytics').then((response) => response.data),
  list: (type?: string) => apiClient.get<{ data: GrowthOpportunity[]; total: number }>('/growth-opportunities', { params: { type: type || undefined, limit: 20 } }).then((response) => response.data),
  detail: (id: string) => apiClient.get<{ opportunity: GrowthOpportunity; events: { id: string; fromStatus: string | null; toStatus: string; note: string; createdAt: string }[]; plans: GrowthPlan[] }>(`/growth-opportunities/${id}`).then((response) => response.data),
  refresh: () => apiClient.post('/growth-opportunities/refresh').then((response) => response.data),
  updateStatus: (id: string, status: string, outcome?: string) => apiClient.patch(`/growth-opportunities/${id}/status`, { status, outcome }).then((response) => response.data),
  assign: (id: string, assignedUserId: string) => apiClient.patch(`/growth-opportunities/${id}/assign`, { assignedUserId }).then((response) => response.data),
  createTask: (id: string) => apiClient.post(`/growth-opportunities/${id}/task`, {}).then((response) => response.data),
  createPlan: (payload: { opportunityId: string; objective: string; expectedOutcome: string }) => apiClient.post('/growth-opportunities/plans', payload).then((response) => response.data),
  completePlan: (id: string, actualOutcome: string) => apiClient.patch(`/growth-opportunities/plans/${id}/complete`, { actualOutcome }).then((response) => response.data),
  draft: (id: string) => apiClient.post<{ body: string; sent: false }>(`/growth-opportunities/${id}/draft`).then((response) => response.data),
  plans: () => apiClient.get<GrowthPlan[]>('/growth-opportunities/plans').then((response) => response.data),
}
