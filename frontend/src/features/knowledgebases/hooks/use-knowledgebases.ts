import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { knowledgebasesApi } from '@/features/knowledgebases/api/knowledgebases.api'
import type {
  CreateKnowledgebaseRequest,
  UpdateKnowledgebaseRequest,
} from '@/features/knowledgebases/types/knowledgebase.types'

export const knowledgebaseKeys = {
  all: ['knowledgebases'] as const,
  lists: () => [...knowledgebaseKeys.all, 'list'] as const,
  list: (search?: string) =>
    [
      ...knowledgebaseKeys.lists(),
      { search: search?.trim() || undefined },
    ] as const,
  details: () => [...knowledgebaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...knowledgebaseKeys.details(), id] as const,
}

export function useKnowledgebases(search?: string) {
  const normalized = search?.trim() || undefined

  return useQuery({
    queryKey: knowledgebaseKeys.list(normalized),
    queryFn: () => knowledgebasesApi.list(normalized),
  })
}

export function useKnowledgebase(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: knowledgebaseKeys.detail(id ?? ''),
    queryFn: () => knowledgebasesApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateKnowledgebase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateKnowledgebaseRequest) =>
      knowledgebasesApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: knowledgebaseKeys.lists(),
      })
      queryClient.setQueryData(knowledgebaseKeys.detail(data.id), data)
    },
  })
}

export function useUpdateKnowledgebase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateKnowledgebaseRequest
    }) => knowledgebasesApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: knowledgebaseKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: knowledgebaseKeys.detail(data.id),
      })
      queryClient.setQueryData(knowledgebaseKeys.detail(data.id), data)
    },
  })
}

export function useDeleteKnowledgebase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => knowledgebasesApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({
        queryKey: knowledgebaseKeys.lists(),
      })
      queryClient.removeQueries({ queryKey: knowledgebaseKeys.detail(id) })
    },
  })
}
