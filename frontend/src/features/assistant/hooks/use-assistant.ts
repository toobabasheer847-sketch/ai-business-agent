import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { assistantApi } from '@/features/assistant/api/assistant.api'
import {
  normalizeDelegation,
  type AssistantMessage,
  type AssistantPersistedMessage,
  type AssistantSource,
} from '@/features/assistant/types/assistant.types'

export const assistantKeys = {
  all: ['assistant'] as const,
  conversations: () => [...assistantKeys.all, 'conversations'] as const,
  messages: (conversationId: string) =>
    [...assistantKeys.all, 'messages', conversationId] as const,
}

function createdAtToMillis(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

export function mapPersistedMessages(
  rows: AssistantPersistedMessage[],
): AssistantMessage[] {
  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === 'object' ? row.metadata : {}

      return {
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: row.content,
        createdAt: createdAtToMillis(row.createdAt),
        delegation: normalizeDelegation(metadata.delegation),
        sources: Array.isArray(metadata.sources)
          ? (metadata.sources as AssistantSource[])
          : undefined,
        usedKnowledge:
          typeof metadata.usedKnowledge === 'boolean'
            ? metadata.usedKnowledge
            : undefined,
        message:
          typeof metadata.message === 'string' ? metadata.message : undefined,
      }
    })
}

export function useSendAssistantMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      message,
      conversationId,
    }: {
      message: string
      conversationId?: string | null
    }) => assistantApi.chat(message, conversationId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: assistantKeys.conversations(),
      })
      if (data.conversationId) {
        void queryClient.invalidateQueries({
          queryKey: assistantKeys.messages(data.conversationId),
        })
      }
    },
  })
}

export function useAssistantMessages(
  conversationId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: assistantKeys.messages(conversationId ?? ''),
    queryFn: () => assistantApi.listMessages(conversationId!),
    enabled: Boolean(conversationId) && enabled,
    select: mapPersistedMessages,
  })
}

export function useAssistantConversations() {
  return useQuery({
    queryKey: assistantKeys.conversations(),
    queryFn: () => assistantApi.listConversations(),
  })
}
