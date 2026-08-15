import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { companiesApi } from '@/features/companies/api/companies.api'
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '@/features/companies/types/company.types'

export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (search?: string) =>
    [...companiesKeys.lists(), { search: search?.trim() || undefined }] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
}

export function useCompanies(search?: string) {
  const normalized = search?.trim() || undefined

  return useQuery({
    queryKey: companiesKeys.list(normalized),
    queryFn: () => companiesApi.list(normalized),
  })
}

export function useCompany(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: companiesKeys.detail(id ?? ''),
    queryFn: () => companiesApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateCompanyRequest) => companiesApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: companiesKeys.lists() })
      queryClient.setQueryData(companiesKeys.detail(data.id), data)
    },
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateCompanyRequest
    }) => companiesApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: companiesKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: companiesKeys.detail(data.id),
      })
      queryClient.setQueryData(companiesKeys.detail(data.id), data)
    },
  })
}

export function useDeleteCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: companiesKeys.lists() })
      queryClient.removeQueries({ queryKey: companiesKeys.detail(id) })
    },
  })
}
