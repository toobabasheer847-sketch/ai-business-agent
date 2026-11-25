import { apiClient } from '@/lib/api'

export type CustomerConversationSummary = {
  conversationId: string
  status: string
  intent: string
  confidence: string
  visitorName: string | null
  visitorEmail: string | null
  leadId: string | null
  handoffAt: string | null
  summary: string
  updatedAt: string
  title: string | null
}

export type CustomerConversationDetail = CustomerConversationSummary & {
  id: string
  intentEvidence: string
  intentSource: string
  handoffReason: string | null
  visitorPhone: string | null
  requirements: string | null
  assignedUserId: string | null
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>
}

export type CustomerAiSettings = {
  publicKey: string
  enabled: boolean
  displayName: string
  welcomeMessage: string
  instructions: string
  leadCaptureEnabled: boolean
  handoffNotificationsEnabled: boolean
  knowledgeBaseId: string | null
  companyId: string | null
  collectName: boolean
  collectEmail: boolean
  collectPhone: boolean
  accent: 'slate' | 'blue' | 'emerald'
}

export const customerFacingApi = {
  conversations(status?: string) {
    return apiClient.get<{ data: CustomerConversationSummary[] }>('/customer-ai/conversations', { params: status ? { status } : undefined }).then((response) => response.data)
  },
  conversation(id: string) {
    return apiClient.get<CustomerConversationDetail>(`/customer-ai/conversations/${id}`).then((response) => response.data)
  },
  assign(id: string, userId: string) {
    return apiClient.post(`/customer-ai/conversations/${id}/assign`, { userId }).then((response) => response.data)
  },
  resolve(id: string) {
    return apiClient.post(`/customer-ai/conversations/${id}/resolve`).then((response) => response.data)
  },
  reopen(id: string) {
    return apiClient.post(`/customer-ai/conversations/${id}/reopen`).then((response) => response.data)
  },
  note(id: string, content: string) {
    return apiClient.post(`/customer-ai/conversations/${id}/notes`, { content }).then((response) => response.data)
  },
  settings() {
    return apiClient.get<CustomerAiSettings>('/customer-ai/settings').then((response) => response.data)
  },
  updateSettings(payload: Partial<CustomerAiSettings>) {
    return apiClient.patch<CustomerAiSettings>('/customer-ai/settings', payload).then((response) => response.data)
  },
}
