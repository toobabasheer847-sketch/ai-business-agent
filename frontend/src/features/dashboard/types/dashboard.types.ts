export type DashboardResourceCount = {
  total: number
}

export type PhoneNumberSummary = {
  total: number
  active: number
}

export type CommunicationHubStats = {
  totalConversations: number
  emailConversations: number
  smsConversations: number
  callConversations: number
  webConversations: number
  activeConversations: number
}

export type AgentStatusResponse = {
  status: string
  agent: string
}

export type DashboardConversation = {
  id: string
  title: string | null
  channel: string
  status: string
  updatedAt: string
  createdAt: string
}

export type DashboardKpiKey =
  | 'companies'
  | 'leads'
  | 'prospects'
  | 'proposals'
  | 'phoneNumbers'
  | 'conversations'
  | 'knowledgebases'
  | 'users'
