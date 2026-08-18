import { apiClient } from '@/lib/api'
import {
  normalizeDelegation,
  type ChatMessageRequest,
  type ChatMessageResponse,
} from '@/features/assistant/types/assistant.types'

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
      }))
  },
}
