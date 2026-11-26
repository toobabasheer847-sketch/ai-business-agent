export type AnalyticsRange = '7d' | '30d' | '90d' | 'custom'

export type AnalyticsQuery = {
  range?: AnalyticsRange
  from?: string
  to?: string
}

export type AnalyticsComparison = {
  current: number
  previous: number | null
  difference: number | null
  percentChange: number | null
  direction: 'up' | 'down' | 'flat' | 'unavailable'
}

export type AnalyticsRate = {
  numerator: number
  denominator: number
  percent: number | null
  definition: string
}

export type AnalyticsWindow = {
  preset: string
  from: string | null
  to: string | null
  timezone: 'UTC'
}

export type AnalyticsInsight = {
  insightId: string
  category: string
  title: string
  description: string
  supportingMetric: string
  currentValue: number | null
  previousValue: number | null
  trend: AnalyticsComparison['direction']
  severity: 'info' | 'watch' | 'attention'
  recommendation: string
  evidencePeriod: string
  kind: 'fact' | 'recommendation'
}

export type SalesAnalytics = {
  window: AnalyticsWindow
  previousWindow: AnalyticsWindow | null
  pipeline: {
    companies: number
    leads: number
    prospects: number
    proposals: number
  }
  comparisons: {
    companies: AnalyticsComparison
    leads: AnalyticsComparison
    prospects: AnalyticsComparison
    proposals: AnalyticsComparison
  }
  leadToProspect: AnalyticsRate
  leadStatus: Array<{ status: string; count: number }>
  prospectStatus: Array<{ status: string; count: number }>
  note: string
}

export type ProposalAnalytics = {
  window: AnalyticsWindow
  currentStatusEvents: {
    draft: number
    generated: number
    sent: number
    viewed: number
    accepted: number
    rejected: number
    expired: number
    cancelled: number
  }
  comparisons: {
    sent: AnalyticsComparison
    accepted: AnalyticsComparison
    rejected: AnalyticsComparison
  }
  acceptanceRate: AnalyticsRate
  rejectionRate: AnalyticsRate
  averageSentToAcceptedHours: number | null
  note: string
}

export type TaskAnalytics = {
  status: {
    pending: number
    inProgress: number
    completed: number
    cancelled: number
    overdue: number
  }
  completionRate: AnalyticsRate
  comparisons: {
    completed: AnalyticsComparison
    overdue: AnalyticsComparison
  }
  note: string
}

export type TeamAnalytics = {
  members: Array<{
    employeeId: string
    name: string
    pending: number
    inProgress: number
    completed: number
    overdue: number
    open: number
  }>
  upcomingDeadlines: Array<{ id: string; title: string; dueAt: string; assigneeName: string | null }>
  note: string
}

export type CommunicationAnalytics = {
  conversations: {
    totalConversations: number
    emailConversations: number
    smsConversations: number
    callConversations: number
    webConversations: number
    whatsappConversations?: number
  }
  comparisons: { total: AnalyticsComparison }
  status: Array<{ status: string; count: number }>
  note: string
}

export type TrendAnalytics = {
  leads: Array<{ day: string; count: number }>
  proposals: Array<{ day: string; count: number }>
  tasksCreated: Array<{ day: string; count: number }>
  tasksCompleted: Array<{ day: string; count: number }>
  note: string
}

export type InsightAnalytics = {
  insights: AnalyticsInsight[]
}
