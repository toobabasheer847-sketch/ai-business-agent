import { apiClient } from '@/lib/api'

export type Cycle = { stages: string[]; current: string }

export type Deviation = {
  metricKey: string
  metricName: string
  deviationType: string
  currentValue: number | null
  baselineValue: number | null
  targetValue: number | null
  deviationValue: number | null
  deviationPercentage: number | null
  trendDirection: string
  confidenceLevel: string
  evidence: string[]
}

export type Bottleneck = {
  id?: string
  fingerprint?: string
  title: string
  category: string
  severity: string
  affectedProcess: string
  status?: string
  evidence: string[] | { lines?: string[] }
  recommendedInvestigation: string
  detectionMethod?: string
  confidenceLevel: string
}

export type Recommendation = {
  id?: string
  key?: string
  title: string
  description: string
  evidence: string[]
  priority?: number
  priorityScore?: number
  confidence?: string
  confidenceLevel?: string
  expectedOutcome: string
  status?: string
  risks?: string
  requiredPermission?: string
  approvalRequired?: boolean
}

export type PlanMilestone = { id: string; title: string; status: string }

export type ImprovementPlan = {
  id: string
  title: string
  objective: string
  status: string
  ownerId: string | null
  baselineValue: string | null
  targetValue: string | null
  reviewSchedule: string | null
  nextReviewAt: string | null
  milestones?: PlanMilestone[]
  assessment?: { progressStatus: string; executionProgress: number | null; outcomeProgress: number | null; reason: string } | null
}

export type Outcome = {
  id: string
  metricKey: string
  baselineValue: string | null
  measuredValue: string | null
  evaluationStatus: string
  evaluationPeriodStart: string
  evaluationPeriodEnd: string
  evidence: { statement?: string; causalClaim?: boolean }
}

export type Review = {
  id: string
  status: string
  summary: string
  reviewPeriodStart: string
  reviewPeriodEnd: string
  decision: string | null
  reviewedAt: string | null
}

export type HistoryEvent = {
  id: string
  eventType: string
  relatedEntityType: string
  occurredAt: string
  actorId: string | null
}

export const continuousImprovementApi = {
  overview: async () =>
    (await apiClient.get<{
      cycle: Cycle
      activePlans: ImprovementPlan[]
      goalsAtRisk: Array<{ id: string; name: string; note: string }>
      deviations: Deviation[]
      bottlenecks: Bottleneck[]
      recommendations: Recommendation[]
      opportunities: Array<{ key: string; title: string; suggestedImprovement: string; potentialBenefit: string }>
      schedule: { note: string }
      classification: { observed: string; causal: string }
    }>('/continuous-improvement/overview')).data,
  deviations: async () => (await apiClient.get<{ data: Deviation[] }>('/continuous-improvement/deviations')).data,
  bottlenecks: async () => (await apiClient.get<{ data: Bottleneck[] }>('/continuous-improvement/bottlenecks')).data,
  reviewBottleneck: async (id: string) => (await apiClient.post(`/continuous-improvement/bottlenecks/${id}/review`)).data,
  resolveBottleneck: async (id: string) => (await apiClient.post(`/continuous-improvement/bottlenecks/${id}/resolve`)).data,
  recommendations: async () => (await apiClient.get<{ data: Recommendation[] }>('/continuous-improvement/recommendations')).data,
  refresh: async () => (await apiClient.post<{ executed: number }>('/continuous-improvement/recommendations/refresh')).data,
  accept: async (id: string) => (await apiClient.post(`/continuous-improvement/recommendations/${id}/accept`)).data,
  reject: async (id: string) => (await apiClient.post(`/continuous-improvement/recommendations/${id}/reject`)).data,
  feedback: async (id: string) => (await apiClient.post(`/continuous-improvement/recommendations/${id}/feedback`, { feedbackType: 'useful' })).data,
  plans: async () => (await apiClient.get<{ data: ImprovementPlan[] }>('/continuous-improvement/plans')).data,
  createPlan: async (body: Record<string, unknown>) => (await apiClient.post('/continuous-improvement/plans', body)).data,
  activate: async (id: string) => (await apiClient.post(`/continuous-improvement/plans/${id}/activate`)).data,
  hold: async (id: string) => (await apiClient.post(`/continuous-improvement/plans/${id}/hold`)).data,
  completePlan: async (id: string) => (await apiClient.post(`/continuous-improvement/plans/${id}/complete`)).data,
  completeMilestone: async (planId: string, milestoneId: string) =>
    (await apiClient.post(`/continuous-improvement/plans/${planId}/milestones/${milestoneId}/complete`)).data,
  outcomes: async () => (await apiClient.get<{ data: Outcome[] }>('/continuous-improvement/outcomes')).data,
  evaluate: async () => (await apiClient.post('/continuous-improvement/outcomes/evaluate')).data,
  reviews: async () => (await apiClient.get<{ data: Review[] }>('/continuous-improvement/reviews')).data,
  createReview: async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    return (await apiClient.post('/continuous-improvement/reviews', { periodStart: start.toISOString(), periodEnd: end.toISOString() })).data
  },
  completeReview: async (id: string, decision: string) =>
    (await apiClient.post(`/continuous-improvement/reviews/${id}/complete`, { decision })).data,
  history: async () => (await apiClient.get<{ data: HistoryEvent[] }>('/continuous-improvement/history')).data,
}
