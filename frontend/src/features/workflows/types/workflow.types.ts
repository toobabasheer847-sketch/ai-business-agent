export type WorkflowDefinition = {
  schemaVersion: 1
  trigger: {
    type: string
    hourUtc?: number
    weekday?: number
    withinDays?: number
    severity?: string
  }
  conditions: Array<{ field: string; operator: string; value: string }>
  actions: Array<{ key: string; type: string; input: Record<string, string> }>
  settings: { maxRetries: number; timeoutMs: number }
}

export type WorkflowRecord = {
  id: string
  name: string
  description: string
  status: string
  triggerType: string
  definition: WorkflowDefinition
  version: number
  createdBy: string | null
  activatedAt: string | null
  pausedAt: string | null
  createdAt: string
  updatedAt: string
  lastExecution?: WorkflowExecution | null
}

export type WorkflowExecution = {
  id: string
  workflowId: string
  workflowVersion: number
  triggerSource: string
  triggerReference: string
  status: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  errorCode: string | null
  sanitizedError: string | null
  steps?: WorkflowStep[]
}

export type WorkflowStep = {
  id: string
  stepKey: string
  actionType: string
  status: string
  attemptCount: number
  approvalId: string | null
  errorCode: string | null
  sanitizedError: string | null
  outputSnapshot: Record<string, unknown>
}

export type WorkflowSummary = {
  total: number
  active: number
  paused: number
  draft: number
  completed: number
  failed: number
  waiting: number
  recentFailures: WorkflowExecution[]
}

export type GenerationResult = {
  proposal: WorkflowDefinition | null
  valid: boolean
  errors: string[]
  missing: string[]
  unsupported: string[]
  source: 'rule' | 'model'
  summary: string
}
