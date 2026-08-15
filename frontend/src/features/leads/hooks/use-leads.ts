import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { leadsApi } from '@/features/leads/api/leads.api'
import type {
  CreateLeadRequest,
  LeadListQuery,
  UpdateLeadRequest,
} from '@/features/leads/types/lead.types'

function normalizeListQuery(query?: LeadListQuery): LeadListQuery | undefined {
  if (!query) return undefined

  const normalized: LeadListQuery = {
    search: query.search?.trim() || undefined,
    status: query.status || undefined,
    companyId: query.companyId || undefined,
    source: query.source?.trim() || undefined,
  }

  if (
    !normalized.search &&
    !normalized.status &&
    !normalized.companyId &&
    !normalized.source
  ) {
    return undefined
  }

  return normalized
}

export const leadsKeys = {
  all: ['leads'] as const,
  lists: () => [...leadsKeys.all, 'list'] as const,
  list: (query?: LeadListQuery) =>
    [...leadsKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...leadsKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadsKeys.details(), id] as const,
}

export function useLeads(query?: LeadListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: leadsKeys.list(normalized),
    queryFn: () => leadsApi.list(normalized),
  })
}

export function useLead(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: leadsKeys.detail(id ?? ''),
    queryFn: () => leadsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateLeadRequest) => leadsApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: leadsKeys.lists() })
      queryClient.setQueryData(leadsKeys.detail(data.id), data)
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateLeadRequest
    }) => leadsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: leadsKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: leadsKeys.detail(data.id),
      })
      queryClient.setQueryData(leadsKeys.detail(data.id), data)
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: leadsKeys.lists() })
      queryClient.removeQueries({ queryKey: leadsKeys.detail(id) })
    },
  })
}
