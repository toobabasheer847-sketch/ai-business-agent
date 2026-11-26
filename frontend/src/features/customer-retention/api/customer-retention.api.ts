import { apiClient } from '@/lib/api'

export type RetentionSignal = {
  code: string
  sourceType: string
  sourceId: string
  observedAt: string
  summary: string
  fact: true
}

export type RetentionAccount = {
  id: string
  companyId: string
  companyName?: string
  classification: 'healthy' | 'attention_needed' | 'at_risk' | 'insufficient_data'
  confidence: string
  dataSufficiency: string
  explanation: string
  signals: RetentionSignal[]
  lastInteractionAt: string | null
  assessedAt: string
  method: 'heuristic'
  predictiveModel: false
  churnProbability: null
}

export type RetentionRecommendation = {
  id: string
  companyId: string
  title: string
  explanation: string
  action: string
  priority: string
  status: string
  confidence: string
  evidence: string
  taskId: string | null
}

export type RetentionPlan = {
  id: string
  companyId: string
  title: string
  objective: string
  status: string
  priority: string
  dueAt: string | null
  expectedOutcome: string
  actualOutcome: string | null
  taskId: string | null
}

export type RetentionAnalytics = {
  customers: number
  healthy: number
  attentionNeeded: number
  atRisk: number
  insufficientData: number
  inactive: number
  openRecommendations: number
  completedPlans: number
  overdueFollowUps: number
  unresolvedConversations: number
  followUpCompletion: { numerator: number; denominator: number; percent: number } | null
  churnRate: null
  retentionRate: null
  customerLifetimeValue: null
  note: string
}

export const customerRetentionApi = {
  analytics: () => apiClient.get<RetentionAnalytics>('/customer-retention/analytics').then((response) => response.data),
  accounts: (classification?: string) => apiClient.get<{ data: RetentionAccount[]; total: number }>('/customer-retention/accounts', { params: { classification, limit: 20 } }).then((response) => response.data),
  account: (companyId: string) => apiClient.get<{ account: RetentionAccount; recommendations: RetentionRecommendation[]; plans: RetentionPlan[] }>(`/customer-retention/accounts/${companyId}`).then((response) => response.data),
  refresh: () => apiClient.post('/customer-retention/refresh').then((response) => response.data),
  recommendations: () => apiClient.get<RetentionRecommendation[]>('/customer-retention/recommendations').then((response) => response.data),
  updateRecommendation: (id: string, status: string) => apiClient.patch(`/customer-retention/recommendations/${id}`, { status }).then((response) => response.data),
  createTask: (id: string, assignedUserId?: string) => apiClient.post(`/customer-retention/recommendations/${id}/task`, { assignedUserId }).then((response) => response.data),
  plans: () => apiClient.get<RetentionPlan[]>('/customer-retention/plans').then((response) => response.data),
  createPlan: (payload: { companyId: string; title: string; objective: string; issue: string; priority: string; evidence: string; expectedOutcome: string }) => apiClient.post('/customer-retention/plans', payload).then((response) => response.data),
  completePlan: (id: string, actualOutcome: string) => apiClient.patch(`/customer-retention/plans/${id}/complete`, { actualOutcome }).then((response) => response.data),
  draft: (companyId: string) => apiClient.post<{ body: string; sent: false }>(`/customer-retention/accounts/${companyId}/draft`).then((response) => response.data),
}
