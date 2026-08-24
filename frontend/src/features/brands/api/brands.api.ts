import { apiClient } from '@/lib/api'
import type {
  Brand,
  CreateBrandRequest,
  DeleteBrandResponse,
  UpdateBrandRequest,
} from '@/features/brands/types/brand.types'

export const brandsApi = {
  list() {
    return apiClient.get<Brand[]>('/brands').then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<Brand>(`/brands/${id}`).then((r) => r.data)
  },

  create(payload: CreateBrandRequest) {
    return apiClient.post<Brand>('/brands', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateBrandRequest) {
    return apiClient
      .patch<Brand>(`/brands/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteBrandResponse>(`/brands/${id}`)
      .then((r) => r.data)
  },
}
