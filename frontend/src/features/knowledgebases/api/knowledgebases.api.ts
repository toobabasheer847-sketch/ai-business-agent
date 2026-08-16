import { apiClient } from '@/lib/api'
import type {
  CreateKnowledgebaseRequest,
  DeleteKnowledgebaseResponse,
  Knowledgebase,
  UpdateKnowledgebaseRequest,
} from '@/features/knowledgebases/types/knowledgebase.types'

function toListParams(search?: string) {
  const trimmed = search?.trim()
  if (!trimmed) return undefined
  return { search: trimmed }
}

export const knowledgebasesApi = {
  list(search?: string) {
    return apiClient
      .get<Knowledgebase[]>('/knowledgebases', { params: toListParams(search) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient
      .get<Knowledgebase>(`/knowledgebases/${id}`)
      .then((r) => r.data)
  },

  create(payload: CreateKnowledgebaseRequest) {
    return apiClient
      .post<Knowledgebase>('/knowledgebases', payload)
      .then((r) => r.data)
  },

  update(id: string, payload: UpdateKnowledgebaseRequest) {
    return apiClient
      .patch<Knowledgebase>(`/knowledgebases/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteKnowledgebaseResponse>(`/knowledgebases/${id}`)
      .then((r) => r.data)
  },
}
