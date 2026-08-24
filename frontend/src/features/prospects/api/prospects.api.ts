import { apiClient } from '@/lib/api'
import type {
  CreateProspectRequest,
  DeleteProspectResponse,
  Prospect,
  ProspectListQuery,
  UpdateProspectRequest,
} from '@/features/prospects/types/prospect.types'

function toListParams(query?: ProspectListQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.search?.trim()) params.search = query.search.trim()
  if (query.status) params.status = query.status
  if (query.companyId) params.companyId = query.companyId
  if (query.leadId) params.leadId = query.leadId

  return Object.keys(params).length > 0 ? params : undefined
}

export const prospectsApi = {
  list(query?: ProspectListQuery) {
    return apiClient
      .get<Prospect[]>('/prospects', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Prospect>(`/prospects/${id}`).then((r) => r.data)
  },

  create(payload: CreateProspectRequest) {
    return apiClient.post<Prospect>('/prospects', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateProspectRequest) {
    return apiClient
      .patch<Prospect>(`/prospects/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteProspectResponse>(`/prospects/${id}`)
      .then((r) => r.data)
  },
}
