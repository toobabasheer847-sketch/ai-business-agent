import { apiClient } from '@/lib/api'

export type Priority = {
  key: string
  title: string
  score: number
  evidence: string
  action: string
  confidence: string
}

export type Opportunity = {
  key: string
  name: string
  benefit: string
  limitation: string
}

export type Recommendation = {
  id: string
  title: string
  description: string
  category: string
  priorityScore: number
  confidenceLevel: string
  evidence: string[]
  reasoning: string
  suggestedAction: string
  expectedOutcome: string
  status: string
}

export type StrategicPlan = {
  id: string
  title: string
  objective: string
  status: string
  metricKey: string
  baselineValue: string | null
  targetValue: string | null
  progress: number | null
  progressNote: string
}

export type ActionStep = {
  id: string
  title: string
  actionType: string
  status: string
  note: string | null
}

export type ActionPlan = {
  id: string
  title: string
  status: string
  steps: ActionStep[]
}

export type Goal = {
  id: string
  name: string
  metricKey: string
  baselineValue: string | null
  currentValue: string | null
  targetValue: string | null
  progress: number | null
  progressNote: string
}

export const strategicDecisionApi = {
  overview: async () => (await apiClient.get<{
    priorities: Priority[]
    opportunities: Opportunity[]
    outcomes: { summary: string }
    schedule: { note: string }
    classification: { recommendations: string }
  }>('/strategic-decisions/overview')).data,
  recommendations: async () => (await apiClient.get<{ data: Recommendation[] }>('/strategic-decisions/recommendations')).data,
  refresh: async () => (await apiClient.post<{ recommendations: number; executed: number }>('/strategic-decisions/recommendations/refresh')).data,
  accept: async (id: string) => (await apiClient.post(`/strategic-decisions/recommendations/${id}/accept`)).data,
  reject: async (id: string) => (await apiClient.post(`/strategic-decisions/recommendations/${id}/reject`)).data,
  feedback: async (id: string, feedbackType: string) => (await apiClient.post(`/strategic-decisions/recommendations/${id}/feedback`, { feedbackType })).data,
  plans: async () => (await apiClient.get<{ data: StrategicPlan[] }>('/strategic-decisions/plans')).data,
  createPlan: async (body: Record<string, unknown>) => (await apiClient.post('/strategic-decisions/plans', body)).data,
  actionPlans: async () => (await apiClient.get<{ data: ActionPlan[] }>('/strategic-decisions/action-plans')).data,
  createActionPlan: async (recommendationId: string) => (await apiClient.post<ActionPlan>('/strategic-decisions/action-plans', { recommendationId })).data,
  execute: async (id: string) => (await apiClient.post<ActionPlan>(`/strategic-decisions/action-plans/${id}/execute`)).data,
  completeStep: async (planId: string, stepId: string) => (await apiClient.post(`/strategic-decisions/action-plans/${planId}/steps/${stepId}/complete`)).data,
  goals: async () => (await apiClient.get<{ data: Goal[] }>('/strategic-decisions/goals')).data,
  createGoal: async (body: Record<string, unknown>) => (await apiClient.post('/strategic-decisions/goals', body)).data,
}
