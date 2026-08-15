import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { conversationsApi } from '@/features/conversations/api/conversations.api'
import type {
  ConversationListQuery,
  CreateConversationRequest,
  UpdateConversationRequest,
} from '@/features/conversations/types/conversation.types'

function normalizeListQuery(
  query?: ConversationListQuery,
): ConversationListQuery | undefined {
  if (!query) return undefined

  const normalized: ConversationListQuery = {
    search: query.search?.trim() || undefined,
    channel: query.channel || undefined,
    status: query.status || undefined,
    prospectId: query.prospectId || undefined,
  }

  if (
    !normalized.search &&
    !normalized.channel &&
    !normalized.status &&
    !normalized.prospectId
  ) {
    return undefined
  }

  return normalized
}

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (query?: ConversationListQuery) =>
    [...conversationKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
}

export function useConversations(query?: ConversationListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: conversationKeys.list(normalized),
    queryFn: () => conversationsApi.list(normalized),
  })
}

export function useConversation(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? ''),
    queryFn: () => conversationsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateConversationRequest) =>
      conversationsApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      queryClient.setQueryData(conversationKeys.detail(data.id), data)
    },
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateConversationRequest
    }) => conversationsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(data.id),
      })
      queryClient.setQueryData(conversationKeys.detail(data.id), data)
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => conversationsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      queryClient.removeQueries({ queryKey: conversationKeys.detail(id) })
      // Matches messageKeys.lists(conversationId) without importing use-messages
      await queryClient.invalidateQueries({
        queryKey: ['messages', 'list', id],
      })
    },
  })
}
