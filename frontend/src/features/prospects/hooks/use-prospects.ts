import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { prospectsApi } from '@/features/prospects/api/prospects.api'
import type {
  CreateProspectRequest,
  ProspectListQuery,
  UpdateProspectRequest,
} from '@/features/prospects/types/prospect.types'

function normalizeListQuery(
  query?: ProspectListQuery,
): ProspectListQuery | undefined {
  if (!query) return undefined

  const normalized: ProspectListQuery = {
    search: query.search?.trim() || undefined,
    status: query.status || undefined,
    companyId: query.companyId || undefined,
    leadId: query.leadId || undefined,
  }

  if (
    !normalized.search &&
    !normalized.status &&
    !normalized.companyId &&
    !normalized.leadId
  ) {
    return undefined
  }

  return normalized
}

export const prospectsKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectsKeys.all, 'list'] as const,
  list: (query?: ProspectListQuery) =>
    [...prospectsKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...prospectsKeys.all, 'detail'] as const,
  detail: (id: string) => [...prospectsKeys.details(), id] as const,
}

export function useProspects(query?: ProspectListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: prospectsKeys.list(normalized),
    queryFn: () => prospectsApi.list(normalized),
  })
}

export function useProspect(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: prospectsKeys.detail(id ?? ''),
    queryFn: () => prospectsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProspectRequest) =>
      prospectsApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: prospectsKeys.lists() })
      queryClient.setQueryData(prospectsKeys.detail(data.id), data)
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateProspectRequest
    }) => prospectsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: prospectsKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: prospectsKeys.detail(data.id),
      })
      queryClient.setQueryData(prospectsKeys.detail(data.id), data)
    },
  })
}

export function useDeleteProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => prospectsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: prospectsKeys.lists() })
      queryClient.removeQueries({ queryKey: prospectsKeys.detail(id) })
    },
  })
}
