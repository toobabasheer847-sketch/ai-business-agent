export type AgentRunStatus = 'running' | 'completed' | 'failed'

export type AgentRun = {
  id: string
  tenantId: string
  userId: string | null
  agentName: string
  correlationId: string
  parentRunId: string | null
  providerExecutionId: string
  provider: string
  model: string
  status: AgentRunStatus
  usageStatus: 'reported' | 'unavailable'
  usageNote: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costStatus: 'estimated' | 'pricing_not_configured' | 'usage_unavailable'
  estimatedInputCost: string | null
  estimatedOutputCost: string | null
  estimatedTotalCost: string | null
  currency: string | null
  pricingSource: string | null
  pricingEffectiveDate: string | null
  durationMs: number | null
  startedAt: string
  completedAt: string | null
  errorCode: string | null
  errorSummary: string | null
}

export type AgentRunPage = {
  data: AgentRun[]
  page: number
  limit: number
  total: number
}

export type MonitoringSummary = {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  runningRuns: number
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  usageUnavailableRuns: number
  estimatedCost: string | null
  currency: string | null
  mixedCurrencies: boolean
  pricingNotConfiguredRuns: number
  averageDurationMs: number | null
  usageOverTime: Array<{ day: string; runs: number }>
  usageOverTimeTruncated: boolean
  costByModel: Array<{ provider: string; model: string; runs: number; estimatedCost: string | null; currency: string | null }>
  runsByAgent: Array<{ agent: string; runs: number }>
}

export type MonitoringFilters = {
  from?: string
  to?: string
  agent?: string
  provider?: string
  model?: string
  status?: string
  page?: number
}
