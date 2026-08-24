export const COMMUNICATION_CHANNELS = ['email', 'sms', 'call', 'web'] as const

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number]
export type CommunicationChannelFilter = CommunicationChannel | 'all'

export type CommunicationDirection = 'inbound' | 'outbound' | 'internal' | null

export type CommunicationHubHistoryItem = {
  id: string
  tenantId: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  prospectId: string | null
  title: string | null
  summary: string | null
  status: string
  participantCount: number
  messageCount: number
  createdAt: string
  updatedAt: string
}

export type CommunicationHubListResponse = {
  data: CommunicationHubHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type CommunicationHubStats = {
  totalConversations: number
  emailConversations: number
  smsConversations: number
  callConversations: number
  webConversations: number
  activeConversations: number
}

export type CommunicationHubMessage = {
  id: string
  role: string
  content: string
  metadata: unknown
  tokenCount: number | null
  createdAt: string
}

export type CommunicationHubDetail = {
  id: string
  tenantId: string
  userId: string | null
  prospectId: string | null
  title: string | null
  slug?: string
  channel: CommunicationChannel
  status: string
  summary: string | null
  createdAt: string
  updatedAt: string
  messages: CommunicationHubMessage[]
}

export type CommunicationHubListQuery = {
  channel?: CommunicationChannelFilter
  prospectId?: string
  search?: string
  page?: number
  limit?: number
}

export type CommunicationHubThreadQuery = {
  prospectId?: string
  search?: string
  page?: number
  limit?: number
}
