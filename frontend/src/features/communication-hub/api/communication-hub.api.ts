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
    direction: query?.direction && query.direction !== 'all' ? query.direction : undefined,
    prospectId: query?.prospectId?.trim() || undefined,
    leadId: query?.leadId?.trim() || undefined,
    assignedUserId: query?.assignedUserId?.trim() || undefined,
    status: query?.status?.trim() || undefined,
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

export const engagementApi = {
  send(body: Record<string, unknown>) {
    return apiClient.post('/communication-hub/engagement/messages', body).then((response) => response.data)
  },
  retry(id: string) {
    return apiClient.post(`/communication-hub/engagement/messages/${id}/retry`).then((response) => response.data)
  },
  cancel(id: string) {
    return apiClient.post(`/communication-hub/engagement/messages/${id}/cancel`).then((response) => response.data)
  },
  preference(subjectType: string, subjectId: string) {
    return apiClient.get('/communication-hub/engagement/preferences', { params: { subjectType, subjectId } }).then((response) => response.data)
  },
  savePreference(body: Record<string, unknown>) {
    return apiClient.put('/communication-hub/engagement/preferences', body).then((response) => response.data)
  },
  templates() {
    return apiClient.get('/communication-hub/engagement/templates').then((response) => response.data)
  },
  saveTemplate(body: Record<string, unknown>) {
    return apiClient.post('/communication-hub/engagement/templates', body).then((response) => response.data)
  },
  campaigns() {
    return apiClient.get('/communication-hub/engagement/campaigns').then((response) => response.data)
  },
  createCampaign(body: Record<string, unknown>) {
    return apiClient.post('/communication-hub/engagement/campaigns', body).then((response) => response.data)
  },
  startCampaign(id: string) {
    return apiClient.post(`/communication-hub/engagement/campaigns/${id}/start`).then((response) => response.data)
  },
  pauseCampaign(id: string) {
    return apiClient.post(`/communication-hub/engagement/campaigns/${id}/pause`).then((response) => response.data)
  },
  cancelCampaign(id: string) {
    return apiClient.post(`/communication-hub/engagement/campaigns/${id}/cancel`).then((response) => response.data)
  },
  draft(body: Record<string, unknown>) {
    return apiClient.post('/communication-hub/engagement/drafts', body).then((response) => response.data)
  },
  analytics() {
    return apiClient.get('/communication-hub/engagement/analytics').then((response) => response.data)
  },
  whatsapp() {
    return apiClient.get('/communication-hub/engagement/whatsapp').then((response) => response.data)
  },
  saveWhatsapp(body: Record<string, unknown>) {
    return apiClient.put('/communication-hub/engagement/whatsapp', body).then((response) => response.data)
  },
  resolve(id: string) {
    return apiClient.post(`/communication-hub/engagement/conversations/${id}/resolve`).then((response) => response.data)
  },
  reopen(id: string) {
    return apiClient.post(`/communication-hub/engagement/conversations/${id}/reopen`).then((response) => response.data)
  },
  assign(id: string, assignedUserId: string) {
    return apiClient.post(`/communication-hub/engagement/conversations/${id}/assign`, { assignedUserId }).then((response) => response.data)
  },
}
