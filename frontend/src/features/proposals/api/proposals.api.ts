import { apiClient } from '@/lib/api'
import type {
  CreateProposalRequest,
  DeleteProposalResponse,
  Proposal,
  ProposalListQuery,
  UpdateProposalRequest,
} from '@/features/proposals/types/proposal.types'

function toListParams(query?: ProposalListQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.status) params.status = query.status
  if (query.prospectId) params.prospectId = query.prospectId
  if (query.createdBy) params.createdBy = query.createdBy
  if (query.search?.trim()) params.search = query.search.trim()

  return Object.keys(params).length > 0 ? params : undefined
}

export const proposalsApi = {
  list(query?: ProposalListQuery) {
    return apiClient
      .get<Proposal[]>('/proposals', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Proposal>(`/proposals/${id}`).then((r) => r.data)
  },

  create(payload: CreateProposalRequest) {
    return apiClient.post<Proposal>('/proposals', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateProposalRequest) {
    return apiClient
      .patch<Proposal>(`/proposals/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteProposalResponse>(`/proposals/${id}`)
      .then((r) => r.data)
  },
}
