export type AnalyticsWindow = {
  preset: string
  from: string | null
  to: string | null
  timezone: 'UTC'
}

export type SavingsEstimate = {
  status: 'estimated' | 'insufficient' | 'no_baseline'
  estimatedSeconds: number | null
  label: string
  lines: Array<{ actionType: string; completed: number; baselineSeconds: number; estimatedSeconds: number }>
  skippedActions: string[]
}

export type WorkflowAnalyticsOverview = {
  window: AnalyticsWindow
  workflows: { total: number; active: number; draft: number; paused: number }
  executions: { total: number; completed: number; failed: number; partiallyCompleted: number; cancelled: number; running: number; waiting: number }
  rates: { successRate: number | null; failureRate: number | null; terminalEligible: number; classification: string }
  duration: { sample: number; averageMs: number | null; medianMs: number | null; p95Ms: number | null }
  savings: SavingsEstimate & {
    baselineSource: string
    today: SavingsEstimate
    week: SavingsEstimate
    month: SavingsEstimate
  }
  ai: {
    totalRuns: number
    failedRuns: number
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
    estimatedCost: string | null
    currency: string | null
    pricingNotConfiguredRuns: number
    billedCost: null
    note: string
    associatedWithExecutions: false
  }
  health: { healthy: number; needsAttention: number; unhealthy: number; insufficientData: number }
}

export type WorkflowTrendDay = {
  day: string
  executions: number
  completed: number
  failed: number
  partiallyCompleted: number
  averageDurationMs: number | null
  estimatedSavingsSeconds: number | null
  savingsStatus: string
  aiRuns: number
  estimatedAiCost: string | null
}

export type WorkflowPerformance = {
  id: string
  name: string
  status: string
  triggerType: string
  executions: number
  successRate: number | null
  failureRate: number | null
  averageDurationMs: number | null
  healthScore: number | null
  healthLabel: string
  healthFactors: string[]
  lastExecutionAt: string | null
}

export type WorkflowRecommendation = {
  id: string
  workflowId: string | null
  workflowName: string | null
  rule: string
  title: string
  evidence: string
  suggestion: string
  impact: string
  status: string
  detectedAt: string
}

export type WorkflowFailureReport = {
  categories: Array<{ errorCode: string; count: number }>
  workflows: Array<{ workflowId: string; name: string; count: number }>
  actions: Array<{ actionType: string; failed: number }>
  recent: Array<{ executionId: string; workflowId: string; workflowName: string; errorCode: string | null; sanitizedError: string | null; startedAt: string }>
}

export type WorkflowAnalyticsDetail = WorkflowPerformance & {
  steps: Array<{ actionType: string; completed: number; failed: number; averageDurationMs: number | null; retriedSteps: number }>
  recommendations: WorkflowRecommendation[]
}
