import { apiClient } from '@/lib/api'
import type {
  Company,
  CreateCompanyRequest,
  DeleteCompanyResponse,
  UpdateCompanyRequest,
} from '@/features/companies/types/company.types'

function toListParams(search?: string) {
  const trimmed = search?.trim()
  if (!trimmed) return undefined
  return { search: trimmed }
}

export const companiesApi = {
  list(search?: string) {
    return apiClient
      .get<Company[]>('/companies', { params: toListParams(search) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Company>(`/companies/${id}`).then((r) => r.data)
  },

  create(payload: CreateCompanyRequest) {
    return apiClient.post<Company>('/companies', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateCompanyRequest) {
    return apiClient
      .patch<Company>(`/companies/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteCompanyResponse>(`/companies/${id}`)
      .then((r) => r.data)
  },
}
