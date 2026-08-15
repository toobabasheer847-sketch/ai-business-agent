import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { proposalsApi } from '@/features/proposals/api/proposals.api'
import type {
  CreateProposalRequest,
  ProposalListQuery,
  UpdateProposalRequest,
} from '@/features/proposals/types/proposal.types'

function normalizeListQuery(
  query?: ProposalListQuery,
): ProposalListQuery | undefined {
  if (!query) return undefined

  const normalized: ProposalListQuery = {
    status: query.status || undefined,
    prospectId: query.prospectId || undefined,
    createdBy: query.createdBy || undefined,
    search: query.search?.trim() || undefined,
  }

  if (
    !normalized.status &&
    !normalized.prospectId &&
    !normalized.createdBy &&
    !normalized.search
  ) {
    return undefined
  }

  return normalized
}

export const proposalKeys = {
  all: ['proposals'] as const,
  lists: () => [...proposalKeys.all, 'list'] as const,
  list: (query?: ProposalListQuery) =>
    [...proposalKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...proposalKeys.all, 'detail'] as const,
  detail: (id: string) => [...proposalKeys.details(), id] as const,
}

export function useProposals(query?: ProposalListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: proposalKeys.list(normalized),
    queryFn: () => proposalsApi.list(normalized),
  })
}

export function useProposal(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: proposalKeys.detail(id ?? ''),
    queryFn: () => proposalsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProposalRequest) =>
      proposalsApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      queryClient.setQueryData(proposalKeys.detail(data.id), data)
    },
  })
}

export function useUpdateProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateProposalRequest
    }) => proposalsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: proposalKeys.detail(data.id),
      })
      queryClient.setQueryData(proposalKeys.detail(data.id), data)
    },
  })
}

export function useDeleteProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => proposalsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      queryClient.removeQueries({ queryKey: proposalKeys.detail(id) })
    },
  })
}
