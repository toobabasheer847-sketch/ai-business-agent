export const ASSISTANT_DELEGATIONS = [
  'rag',
  'chat',
  'task',
  'communication',
  'proposal',
  'status',
] as const

export type AssistantDelegation = (typeof ASSISTANT_DELEGATIONS)[number]

export type ChatMessageRequest = {
  message: string
  conversationId?: string
}

export type ChatMessageResponse = {
  conversationId: string
  response: string
  delegation: AssistantDelegation | null
  sources?: AssistantSource[]
  usedKnowledge?: boolean
  message?: string
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
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}
