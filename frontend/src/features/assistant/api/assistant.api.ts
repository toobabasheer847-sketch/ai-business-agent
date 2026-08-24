import { apiClient } from '@/lib/api'
import {
  isConversationId,
  normalizeDelegation,
  type AssistantConversationSummary,
  type AssistantPersistedMessage,
  type AssistantSource,
  type ChatMessageRequest,
  type ChatMessageResponse,
} from '@/features/assistant/types/assistant.types'

function normalizeSources(value: unknown): AssistantSource[] {
  if (!Array.isArray(value)) {
    return []
  }

  const sources: AssistantSource[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const source = item as Record<string, unknown>
    if (typeof source.chunkId !== 'string') {
      continue
    }

    sources.push({
      chunkId: source.chunkId,
      chunkIndex:
        typeof source.chunkIndex === 'string' ||
        typeof source.chunkIndex === 'number'
          ? source.chunkIndex
          : source.chunkIndex === null
            ? null
            : undefined,
      documentId:
        typeof source.documentId === 'string' ? source.documentId : null,
      documentName:
        typeof source.documentName === 'string' ? source.documentName : null,
      source: typeof source.source === 'string' ? source.source : null,
      sourceType:
        typeof source.sourceType === 'string' ? source.sourceType : null,
    })
  }

  return sources
}

function normalizeChatResponse(data: ChatMessageResponse | undefined) {
  const conversationId = data?.conversationId

  return {
    conversationId: isConversationId(conversationId) ? conversationId : '',
    response: typeof data?.response === 'string' ? data.response : '',
    delegation: normalizeDelegation(data?.delegation),
    sources: normalizeSources(data?.sources),
    usedKnowledge:
      typeof data?.usedKnowledge === 'boolean' ? data.usedKnowledge : undefined,
    message: typeof data?.message === 'string' ? data.message : undefined,
  }
}

export const assistantApi = {
  chat(message: string, conversationId?: string | null) {
    const payload: ChatMessageRequest = { message }
    if (conversationId) {
      payload.conversationId = conversationId
    }

    return apiClient
      .post<ChatMessageResponse>('/ai/chat', payload, {
        timeout: 120_000,
      })
      .then((r) => normalizeChatResponse(r.data))
  },

  listConversations() {
    return apiClient
      .get<AssistantConversationSummary[]>('/ai/conversations')
      .then((r) => (Array.isArray(r.data) ? r.data : []))
  },

  listMessages(conversationId: string) {
    return apiClient
      .get<AssistantPersistedMessage[]>(
        `/ai/conversations/${conversationId}/messages`,
      )
      .then((r) => (Array.isArray(r.data) ? r.data : []))
  },

  deleteConversation(conversationId: string) {
    return apiClient.delete(`/ai/conversations/${conversationId}`)
  },
}
