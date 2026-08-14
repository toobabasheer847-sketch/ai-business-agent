import { apiClient } from '@/lib/api'
import type {
  AvailablePhoneNumber,
  AvailablePhoneNumbersQuery,
  BoughtPhoneNumber,
  BuyPhoneNumberPayload,
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

function toAvailableQueryParams(query: AvailablePhoneNumbersQuery) {
  const params: Record<string, string | number> = {}
  if (query.countryCode) params.countryCode = query.countryCode
  if (query.locality?.trim()) params.locality = query.locality.trim()
  if (query.areaCode !== undefined) params.areaCode = query.areaCode
  if (query.contains?.trim()) params.contains = query.contains.trim()
  if (query.type) params.type = query.type
  if (query.limit !== undefined) params.limit = query.limit
  return params
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

  searchAvailable(query: AvailablePhoneNumbersQuery) {
    return apiClient
      .get<AvailablePhoneNumber[]>('/phone-numbers/available', {
        params: toAvailableQueryParams(query),
      })
      .then((r) => r.data)
  },

  buy(payload: BuyPhoneNumberPayload) {
    return apiClient
      .post<BoughtPhoneNumber>('/phone-numbers/buy', payload)
      .then((r) => r.data)
  },
}
