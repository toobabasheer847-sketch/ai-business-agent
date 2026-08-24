import { apiClient } from '@/lib/api'
import type {
  Conversation,
  ConversationListQuery,
  CreateConversationRequest,
  CreateNestedMessageRequest,
  DeleteConversationResponse,
  Message,
  UpdateConversationRequest,
} from '@/features/conversations/types/conversation.types'

function toListParams(query?: ConversationListQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.search?.trim()) params.search = query.search.trim()
  if (query.channel) params.channel = query.channel
  if (query.status) params.status = query.status
  if (query.prospectId) params.prospectId = query.prospectId

  return Object.keys(params).length > 0 ? params : undefined
}

export const conversationsApi = {
  list(query?: ConversationListQuery) {
    return apiClient
      .get<Conversation[]>('/conversations', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient
      .get<Conversation>(`/conversations/${id}`)
      .then((r) => r.data)
  },

  create(payload: CreateConversationRequest) {
    return apiClient
      .post<Conversation>('/conversations', payload)
      .then((r) => r.data)
  },

  update(id: string, payload: UpdateConversationRequest) {
    return apiClient
      .patch<Conversation>(`/conversations/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteConversationResponse>(`/conversations/${id}`)
      .then((r) => r.data)
  },

  listMessages(conversationId: string) {
    return apiClient
      .get<Message[]>(`/conversations/${conversationId}/messages`)
      .then((r) => r.data)
  },

  addMessage(conversationId: string, payload: CreateNestedMessageRequest) {
    return apiClient
      .post<Message>(`/conversations/${conversationId}/messages`, payload)
      .then((r) => r.data)
  },
}
