import { apiClient } from '@/lib/api'
import type {
  CreateLeadRequest,
  DeleteLeadResponse,
  Lead,
  LeadListQuery,
  UpdateLeadRequest,
} from '@/features/leads/types/lead.types'

function toListParams(query?: LeadListQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.search?.trim()) params.search = query.search.trim()
  if (query.status) params.status = query.status
  if (query.companyId) params.companyId = query.companyId
  if (query.source?.trim()) params.source = query.source.trim()

  return Object.keys(params).length > 0 ? params : undefined
}

export const leadsApi = {
  list(query?: LeadListQuery) {
    return apiClient
      .get<Lead[]>('/leads', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Lead>(`/leads/${id}`).then((r) => r.data)
  },

  create(payload: CreateLeadRequest) {
    return apiClient.post<Lead>('/leads', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateLeadRequest) {
    return apiClient
      .patch<Lead>(`/leads/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteLeadResponse>(`/leads/${id}`)
      .then((r) => r.data)
  },
}
