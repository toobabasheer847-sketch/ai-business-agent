export const ASSISTANT_DELEGATIONS = [
  'rag',
  'chat',
  'task',
  'communication',
  'proposal',
  'status',
  'orchestrator',
  'team',
] as const

export type AssistantDelegation = (typeof ASSISTANT_DELEGATIONS)[number]

export type ChatMessageRequest = {
  message: string
  conversationId?: string
}

export type OrchestrationOperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_confirmation'

export type OrchestrationOperation = {
  operationId: string
  agent: string
  action: string
  status: OrchestrationOperationStatus | string
  summary?: string
  failureCategory?: string
}

export type AssistantOrchestration = {
  id: string
  status: string
  detectedIntents: string[]
  clarification: string | null
  operations: OrchestrationOperation[]
}

export type ChatMessageResponse = {
  conversationId: string
  response: string
  delegation: AssistantDelegation | null
  sources?: AssistantSource[]
  usedKnowledge?: boolean
  message?: string
  orchestration?: AssistantOrchestration | null
}

export type AssistantSource = {
  chunkId: string
  chunkIndex?: string | number | null
  documentId?: string | null
  documentName?: string | null
  source?: string | null
  sourceType?: string | null
}

export type AssistantRole = 'user' | 'assistant'

export type AssistantMessage = {
  id: string
  role: AssistantRole
  content: string
  createdAt: number
  delegation?: AssistantDelegation | null
  sources?: AssistantSource[]
  usedKnowledge?: boolean
  message?: string
  pending?: boolean
  error?: boolean
  orchestration?: AssistantOrchestration | null
}

export type AssistantConversationSummary = {
  id: string
  title: string | null
  updatedAt: string
  createdAt: string
  channel: string
  status: string
}

export type AssistantPersistedMessage = {
  id: string
  role: string
  content: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export const ASSISTANT_CONVERSATION_STORAGE_KEY = 'aba.assistant.conversationId'

const DELEGATION_SET = new Set<string>(ASSISTANT_DELEGATIONS)

export function normalizeDelegation(value: unknown): AssistantDelegation | null {
  if (typeof value === 'string' && DELEGATION_SET.has(value)) {
    return value as AssistantDelegation
  }
  return null
}

export const DELEGATION_LABELS: Record<AssistantDelegation, string> = {
  rag: 'Knowledge',
  chat: 'Assistant',
  task: 'Task',
  communication: 'Communication',
  proposal: 'Proposal',
  status: 'Status',
  orchestrator: 'Orchestrator',
  team: 'Team',
}

export function normalizeOrchestration(value: unknown): AssistantOrchestration | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !Array.isArray(record.operations)) return null
  const operations = record.operations.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const operation = item as Record<string, unknown>
    if (typeof operation.operationId !== 'string' || typeof operation.action !== 'string') return []
    return [{
      operationId: operation.operationId,
      agent: typeof operation.agent === 'string' ? operation.agent : 'unknown',
      action: operation.action,
      status: typeof operation.status === 'string' ? operation.status : 'pending',
      summary: typeof operation.summary === 'string' ? operation.summary : undefined,
      failureCategory: typeof operation.failureCategory === 'string' ? operation.failureCategory : undefined,
    }]
  })
  return {
    id: record.id,
    status: typeof record.status === 'string' ? record.status : 'completed',
    detectedIntents: Array.isArray(record.detectedIntents)
      ? record.detectedIntents.filter((item) => typeof item === 'string')
      : [],
    clarification: typeof record.clarification === 'string' ? record.clarification : null,
    operations,
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}
