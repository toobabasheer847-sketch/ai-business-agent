export const ASSISTANT_DELEGATIONS = [
  'rag',
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
}

export type AssistantRole = 'user' | 'assistant'

export type AssistantMessage = {
  id: string
  role: AssistantRole
  content: string
  createdAt: number
  delegation?: AssistantDelegation | null
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
  task: 'Task',
  communication: 'Communication',
  proposal: 'Proposal',
  status: 'Status',
}
