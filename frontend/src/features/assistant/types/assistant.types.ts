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
}

export type ChatMessageResponse = {
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
