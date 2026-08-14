import { apiClient } from '@/lib/api'
import type {
  CreateTwilioAppPayload,
  DeleteTwilioAppResponse,
  TwilioApp,
  TwilioAppQuery,
  UpdateTwilioAppPayload,
} from '@/features/twilio-apps/types/twilio-app.types'

function toQueryParams(query?: TwilioAppQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.phoneNumberId) params.phoneNumberId = query.phoneNumberId
  if (query.status) params.status = query.status
  if (query.search?.trim()) params.search = query.search.trim()
  return Object.keys(params).length > 0 ? params : undefined
}

export const twilioAppsApi = {
  list(query?: TwilioAppQuery) {
    return apiClient
      .get<TwilioApp[]>('/twilio-apps', { params: toQueryParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<TwilioApp>(`/twilio-apps/${id}`).then((r) => r.data)
  },

  create(payload: CreateTwilioAppPayload) {
    return apiClient
      .post<TwilioApp>('/twilio-apps', payload)
      .then((r) => r.data)
  },

  update(id: string, payload: UpdateTwilioAppPayload) {
    return apiClient
      .patch<TwilioApp>(`/twilio-apps/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteTwilioAppResponse>(`/twilio-apps/${id}`)
      .then((r) => r.data)
  },
}
