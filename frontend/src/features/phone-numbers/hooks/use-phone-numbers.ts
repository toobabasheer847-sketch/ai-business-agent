import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { phoneNumbersApi } from '@/features/phone-numbers/api/phone-numbers.api'
import type {
  AvailablePhoneNumbersQuery,
  BuyPhoneNumberPayload,
  CreatePhoneNumberPayload,
  PhoneNumberQuery,
  UpdatePhoneNumberPayload,
} from '@/features/phone-numbers/types/phone-number.types'

export const phoneNumberKeys = {
  all: ['phone-numbers'] as const,
  lists: () => [...phoneNumberKeys.all, 'list'] as const,
  list: (query?: PhoneNumberQuery) => [...phoneNumberKeys.lists(), query ?? {}] as const,
  details: () => [...phoneNumberKeys.all, 'detail'] as const,
  detail: (id: string) => [...phoneNumberKeys.details(), id] as const,
  available: (query?: AvailablePhoneNumbersQuery) =>
    [...phoneNumberKeys.all, 'available', query ?? {}] as const,
}

export function usePhoneNumbers(query?: PhoneNumberQuery) {
  return useQuery({
    queryKey: phoneNumberKeys.list(query),
    queryFn: () => phoneNumbersApi.list(query),
  })
}

export function usePhoneNumber(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: phoneNumberKeys.detail(id ?? ''),
    queryFn: () => phoneNumbersApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreatePhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePhoneNumberPayload) => phoneNumbersApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.lists() })
    },
  })
}

export function useUpdatePhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePhoneNumberPayload }) =>
      phoneNumbersApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.detail(data.id) })
    },
  })
}

export function useDeletePhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => phoneNumbersApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.lists() })
      queryClient.removeQueries({ queryKey: phoneNumberKeys.detail(id) })
    },
  })
}

export function useAvailablePhoneNumbers(
  query: AvailablePhoneNumbersQuery | null,
  enabled = true,
) {
  return useQuery({
    queryKey: phoneNumberKeys.available(query ?? undefined),
    queryFn: () => phoneNumbersApi.searchAvailable(query!),
    enabled: Boolean(query) && enabled,
    retry: false,
  })
}

export function useDisconnectTwilio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => phoneNumbersApi.disconnectTwilio(id),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: phoneNumberKeys.detail(data.id),
      })
    },
  })
}

export function useBuyPhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BuyPhoneNumberPayload) => phoneNumbersApi.buy(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: phoneNumberKeys.lists() })
    },
  })
}
