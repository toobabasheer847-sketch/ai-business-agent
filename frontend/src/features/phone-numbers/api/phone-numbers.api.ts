import { apiClient } from '@/lib/api'
import type {
  CreatePhoneNumberPayload,
  DeletePhoneNumberResponse,
  PhoneNumber,
  PhoneNumberQuery,
  UpdatePhoneNumberPayload,
} from '@/features/phone-numbers/types/phone-number.types'

function toQueryParams(query?: PhoneNumberQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.provider) params.provider = query.provider
  if (query.status) params.status = query.status
  if (query.search?.trim()) params.search = query.search.trim()
  return Object.keys(params).length > 0 ? params : undefined
}

export const phoneNumbersApi = {
  list(query?: PhoneNumberQuery) {
    return apiClient
      .get<PhoneNumber[]>('/phone-numbers', { params: toQueryParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<PhoneNumber>(`/phone-numbers/${id}`).then((r) => r.data)
  },

  create(payload: CreatePhoneNumberPayload) {
    return apiClient.post<PhoneNumber>('/phone-numbers', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdatePhoneNumberPayload) {
    return apiClient
      .patch<PhoneNumber>(`/phone-numbers/${id}`, payload)
      .then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeletePhoneNumberResponse>(`/phone-numbers/${id}`)
      .then((r) => r.data)
  },
}
