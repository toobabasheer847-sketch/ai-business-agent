export type ForecastView = {
  metric: string
  status: 'forecast' | 'INSUFFICIENT_DATA'
  method: string | null
  horizonDays: number
  predicted: number | null
  lower: number | null
  upper: number | null
  confidence: string
  weeks: number
  observations: number
  warnings: string[]
  holdout: { predicted: number; actual: number; absoluteError: number; percentageError: number | null } | null
}

export type PipelineBucket = {
  currency: string
  accepted: string
  pending: string
  rejected: string
  acceptedCount: number
  pendingCount: number
  rejectedCount: number
  missingPrice: number
  forecastPotential: number | null
  forecastStatus: 'estimated' | 'INSUFFICIENT_DATA'
  label: string
}

export type BusinessOverview = {
  window: { preset: string; timezone: 'UTC' }
  horizonDays: number
  history: {
    leadsCreated: number
    previousLeads: number
    prospectsCreated: number
    companiesCreated: number
    acceptance: { decided: number; rate: number | null }
    conversion: { explanation: string; conversionRate: number | null; individualProbabilities: false }
  }
  pipeline: PipelineBucket[]
  workload: { open: number; overdue: number; dueNext7Days: number }
  risks: Array<{ title: string }>
  forecasts: ForecastView[]
  classification: { facts: string; forecasts: string; revenue: string }
}

export type LeadInsights = {
  conversion: {
    created: number
    converted: number
    lost: number
    open: number
    terminal: number
    conversionRate: number | null
    individualProbabilities: false
    explanation: string
    pattern: { withTaskRate: number; withoutTaskRate: number; note: string } | null
  }
}

export type WorkloadView = {
  workload: {
    open: number
    overdue: number
    dueNext7Days: number
    note: string
    completionForecast: 'available' | 'INSUFFICIENT_DATA'
    busiest: { name: string; open: number } | null
    users: Array<{ userId: string; name: string; open: number; overdue: number }>
    averageCompletionMs: number | null
  }
}

export type RiskView = {
  key: string
  severity: 'low' | 'medium' | 'high'
  title: string
  evidence: string
  comparison: string
  action: string
  confidence: string
  predictive: boolean
}

export type InsightView = {
  key: string
  category: string
  severity: string
  title: string
  description: string
  evidence: string
  confidence: string
  recommendation: string
  suggestion: true
}
