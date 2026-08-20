import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { knowledgeDocumentsApi } from '@/features/knowledgebases/api/knowledge-documents.api'
import type { KnowledgeDocumentStatus } from '@/features/knowledgebases/types/knowledge-document.types'
import { knowledgebaseKeys } from '@/features/knowledgebases/hooks/use-knowledgebases'

export const knowledgeDocumentKeys = {
  all: [...knowledgebaseKeys.all, 'documents'] as const,
  lists: () => [...knowledgeDocumentKeys.all, 'list'] as const,
  list: (knowledgeBaseId: string) =>
    [...knowledgeDocumentKeys.lists(), knowledgeBaseId] as const,
}

function isActiveStatus(status: KnowledgeDocumentStatus) {
  return status === 'pending' || status === 'processing'
}

export function useKnowledgeDocuments(
  knowledgeBaseId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: knowledgeDocumentKeys.list(knowledgeBaseId ?? ''),
    queryFn: () => knowledgeDocumentsApi.list(knowledgeBaseId!),
    enabled: Boolean(knowledgeBaseId) && enabled,
    refetchInterval: (query) => {
      const documents = query.state.data
      if (!documents?.some((document) => isActiveStatus(document.status))) {
        return false
      }
      return 2500
    },
  })
}

export function useUploadKnowledgeDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) =>
      knowledgeDocumentsApi.upload(knowledgeBaseId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentKeys.list(knowledgeBaseId),
      })
    },
  })
}

export function useRetryKnowledgeDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      knowledgeDocumentsApi.retry(knowledgeBaseId, documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentKeys.list(knowledgeBaseId),
      })
    },
  })
}

export function useDeleteKnowledgeDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      knowledgeDocumentsApi.remove(knowledgeBaseId, documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentKeys.list(knowledgeBaseId),
      })
    },
  })
}
