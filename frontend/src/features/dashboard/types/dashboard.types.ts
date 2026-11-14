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

export type DashboardRangePreset = 'lifetime' | '7d' | '30d' | '90d' | 'custom'

export type DashboardWindow = {
  preset: DashboardRangePreset
  from: string | null
  to: string | null
  timezone: 'UTC'
}

export type DashboardOverviewCounts = {
  companies: number
  leads: number
  prospects: number
  proposals: number
  draftProposals: number
  generatedProposals: number
  sentProposals: number
  viewedProposals: number
  acceptedProposals: number
  rejectedProposals: number
  pendingTasks: number
  completedTasks: number
  overdueTasks: number
}

export type DashboardOverview = {
  window: DashboardWindow
  lifetime: DashboardOverviewCounts
  filtered: DashboardOverviewCounts | null
}

export type DashboardPipelineCounts = {
  companies: number
  leads: number
  prospects: number
  proposals: number
  companiesWithLeads: number
  leadsWithProspects: number
  prospectsWithProposals: number
}

export type DashboardPipeline = {
  window: DashboardWindow
  lifetime: DashboardPipelineCounts
  filtered: DashboardPipelineCounts | null
}

export type DashboardTaskSummary = {
  window: DashboardWindow
  current: {
    pending: number
    completed: number
    overdue: number
    dueToday: number
    dueThisWeek: number
  }
  filtered: {
    pending: number
    completed: number
    overdue: number
  } | null
}

export type DashboardActivityItem = {
  id: string
  kind: string
  title: string
  occurredAt: string
}

export type DashboardActivity = {
  window: DashboardWindow
  items: DashboardActivityItem[]
}

export type DashboardCommunicationCounts = {
  totalConversations: number
  emailConversations: number
  smsConversations: number
  callConversations: number
  webConversations: number
}

export type DashboardCommunications = {
  window: DashboardWindow
  lifetime: DashboardCommunicationCounts
  filtered: DashboardCommunicationCounts | null
  recent: Array<{
    id: string
    channel: string
    title: string | null
    status: string
    updatedAt: string
  }>
}

export type DashboardRangeQuery = {
  range?: '7d' | '30d' | '90d' | 'custom'
  from?: string
  to?: string
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
