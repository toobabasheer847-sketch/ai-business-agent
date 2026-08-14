import { apiClient } from '@/lib/api'
import type {
  AgentStatusResponse,
  CommunicationHubStats,
  DashboardConversation,
  PhoneNumberSummary,
} from '@/features/dashboard/types/dashboard.types'

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : []
}

async function countResource(path: string): Promise<number> {
  const { data } = await apiClient.get<unknown>(path)
  return asArray(data).length
}

export const dashboardApi = {
  countCompanies: () => countResource('/companies'),
  countLeads: () => countResource('/leads'),
  countProspects: () => countResource('/prospects'),
  countProposals: () => countResource('/proposals'),
  countConversations: () => countResource('/conversations'),
  countKnowledgebases: () => countResource('/knowledgebases'),
  countUsers: () => countResource('/users'),

  async phoneNumberSummary(): Promise<PhoneNumberSummary> {
    const { data } = await apiClient.get<unknown>('/phone-numbers')
    const rows = asArray<{ status?: string }>(data)
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === 'active').length,
    }
  },

  async communicationStats(): Promise<CommunicationHubStats> {
    const { data } = await apiClient.get<CommunicationHubStats>(
      '/communication-hub/stats',
    )
    return data
  },

  async recentConversations(limit = 5): Promise<DashboardConversation[]> {
    const { data } = await apiClient.get<unknown>('/conversations')
    return asArray<DashboardConversation>(data).slice(0, limit)
  },

  async masterAgentStatus(): Promise<AgentStatusResponse> {
    const { data } = await apiClient.get<AgentStatusResponse>('/ai/master/status')
    return data
  },

  async communicationAgentStatus(): Promise<AgentStatusResponse> {
    const { data } = await apiClient.get<AgentStatusResponse>(
      '/ai/communication/status',
    )
    return data
  },
}
