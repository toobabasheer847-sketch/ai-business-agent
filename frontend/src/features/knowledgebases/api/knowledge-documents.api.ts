import { apiClient } from '@/lib/api'
import type {
  DeleteKnowledgeDocumentResponse,
  KnowledgeDocument,
} from '@/features/knowledgebases/types/knowledge-document.types'

export const knowledgeDocumentsApi = {
  list(knowledgeBaseId: string) {
    return apiClient
      .get<KnowledgeDocument[]>(
        `/knowledgebases/${knowledgeBaseId}/documents`,
      )
      .then((r) => r.data)
  },

  upload(knowledgeBaseId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient
      .post<KnowledgeDocument>(
        `/knowledgebases/${knowledgeBaseId}/documents`,
        formData,
        {
          timeout: 120_000,
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      )
      .then((r) => r.data)
  },

  retry(knowledgeBaseId: string, documentId: string) {
    return apiClient
      .post<KnowledgeDocument>(
        `/knowledgebases/${knowledgeBaseId}/documents/${documentId}/retry`,
      )
      .then((r) => r.data)
  },

  remove(knowledgeBaseId: string, documentId: string) {
    return apiClient
      .delete<DeleteKnowledgeDocumentResponse>(
        `/knowledgebases/${knowledgeBaseId}/documents/${documentId}`,
      )
      .then((r) => r.data)
  },
}
