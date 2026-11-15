import { apiClient } from '@/lib/api'
import { listAllPages } from '@/lib/api/paged-list'
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
    return listAllPages<Company>('/companies', toListParams(search))
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
