import { apiClient } from '@/lib/api'
import {
  normalizeDelegation,
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

export const assistantApi = {
  chat(message: string) {
    const payload: ChatMessageRequest = { message }

    return apiClient
      .post<ChatMessageResponse>('/ai/chat', payload, {
        timeout: 120_000,
      })
      .then((r) => ({
        response: typeof r.data?.response === 'string' ? r.data.response : '',
        delegation: normalizeDelegation(r.data?.delegation),
        sources: normalizeSources(r.data?.sources),
        usedKnowledge:
          typeof r.data?.usedKnowledge === 'boolean'
            ? r.data.usedKnowledge
            : undefined,
        message: typeof r.data?.message === 'string' ? r.data.message : undefined,
      }))
  },
}
