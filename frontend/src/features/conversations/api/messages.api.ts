import { apiClient } from '@/lib/api'
import type {
  CreateMessageRequest,
  DeleteMessageResponse,
  Message,
  MessageListQuery,
  UpdateMessageRequest,
} from '@/features/conversations/types/conversation.types'

function toListParams(query: MessageListQuery) {
  const params: Record<string, string> = {
    conversationId: query.conversationId,
  }
  if (query.role) params.role = query.role
  return params
}

export const messagesApi = {
  list(query: MessageListQuery) {
    return apiClient
      .get<Message[]>('/messages', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Message>(`/messages/${id}`).then((r) => r.data)
  },

  create(payload: CreateMessageRequest) {
    return apiClient.post<Message>('/messages', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateMessageRequest) {
    return apiClient
      .patch<Message>(`/messages/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteMessageResponse>(`/messages/${id}`)
      .then((r) => r.data)
  },
}
