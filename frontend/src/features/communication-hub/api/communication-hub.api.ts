import { apiClient } from '@/lib/api'
import type {
  CommunicationHubDetail,
  CommunicationHubListQuery,
  CommunicationHubListResponse,
  CommunicationHubStats,
  CommunicationHubThreadQuery,
} from '@/features/communication-hub/types/communication-hub.types'

function normalizeText(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function toListParams(query?: CommunicationHubListQuery) {
  const params: Record<string, string | number | undefined> = {
    channel:
      query?.channel && query.channel !== 'all' ? query.channel : undefined,
    prospectId: query?.prospectId?.trim() || undefined,
    search: normalizeText(query?.search),
    page: query?.page,
    limit: query?.limit,
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )
}

function toThreadParams(query?: CommunicationHubThreadQuery) {
  const params: Record<string, string | number | undefined> = {
    prospectId: query?.prospectId?.trim() || undefined,
    search: normalizeText(query?.search),
    page: query?.page,
    limit: query?.limit,
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )
}

export const communicationHubApi = {
  list(query?: CommunicationHubListQuery) {
    return apiClient
      .get<CommunicationHubListResponse>('/communication-hub', {
        params: toListParams(query),
      })
      .then((response) => response.data)
  },

  stats() {
    return apiClient
      .get<CommunicationHubStats>('/communication-hub/stats')
      .then((response) => response.data)
  },

  getEmailThreads(query?: CommunicationHubThreadQuery) {
    return apiClient
      .get<CommunicationHubListResponse>('/communication-hub/email-threads', {
        params: toThreadParams(query),
      })
      .then((response) => response.data)
  },

  getSmsThreads(query?: CommunicationHubThreadQuery) {
    return apiClient
      .get<CommunicationHubListResponse>('/communication-hub/sms-threads', {
        params: toThreadParams(query),
      })
      .then((response) => response.data)
  },

  getById(id: string) {
    return apiClient
      .get<CommunicationHubDetail>(`/communication-hub/${id}`)
      .then((response) => response.data)
  },
}
