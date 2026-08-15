import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { messagesApi } from '@/features/conversations/api/messages.api'
import { conversationKeys } from '@/features/conversations/hooks/use-conversations'
import type {
  CreateMessageRequest,
  MessageRole,
  UpdateMessageRequest,
} from '@/features/conversations/types/conversation.types'

export const messageKeys = {
  all: ['messages'] as const,
  lists: (conversationId: string) =>
    [...messageKeys.all, 'list', conversationId] as const,
  list: (conversationId: string, role?: MessageRole) =>
    [...messageKeys.lists(conversationId), role ?? {}] as const,
  details: () => [...messageKeys.all, 'detail'] as const,
  detail: (id: string) => [...messageKeys.details(), id] as const,
}

export function useConversationMessages(
  conversationId: string | undefined,
  role?: MessageRole,
  enabled = true,
) {
  return useQuery({
    queryKey: messageKeys.list(conversationId ?? '', role),
    queryFn: () =>
      messagesApi.list({
        conversationId: conversationId!,
        role,
      }),
    enabled: Boolean(conversationId) && enabled,
  })
}

export function useCreateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateMessageRequest) => messagesApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.lists(data.conversationId),
      })
      queryClient.setQueryData(messageKeys.detail(data.id), data)
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(data.conversationId),
      })
    },
  })
}

export function useUpdateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateMessageRequest
    }) => messagesApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.lists(data.conversationId),
      })
      await queryClient.invalidateQueries({
        queryKey: messageKeys.detail(data.id),
      })
      queryClient.setQueryData(messageKeys.detail(data.id), data)
    },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; conversationId: string }) =>
      messagesApi.remove(id),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.lists(variables.conversationId),
      })
      queryClient.removeQueries({
        queryKey: messageKeys.detail(variables.id),
      })
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(variables.conversationId),
      })
    },
  })
}
