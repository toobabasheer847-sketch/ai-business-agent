export type ExceptionRecord = {
  id: string
  exceptionKey: string
  category: string
  severity: string
  title: string
  description: string
  sourceType: string
  sourceId: string
  status: string
  detectedAt: string
  lastDetectedAt: string
  occurrenceCount: number
  priorityScore: number
  priorityReason: string
  recommendedAction: string
  recommendedActionType: string
  assignedTo: string | null
  assigneeName?: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
  dismissedAt: string | null
  resolutionNote: string | null
  metadata: Record<string, string | number | boolean | null>
  evidence?: string
  suggestion?: string
  suggestionSource?: 'rule' | 'model'
}

export type ExceptionSummary = {
  open: number
  critical: number
  high: number
  acknowledged: number
  resolved: number
  resolvedToday: number
  categories: Record<string, number>
  insight: string
  insightSource: 'rule'
}

export type ExceptionFilters = {
  page?: number
  limit?: number
  search?: string
  category?: string
  severity?: string
  status?: string
  assignedTo?: string
  from?: string
  to?: string
  sort?: 'priority' | 'detectedAt'
}

export type ExceptionPage = {
  data: ExceptionRecord[]
  total: number
}
