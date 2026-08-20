/** Matches GET/POST /api/knowledgebases/:id/documents — API-exposed fields only */
export type KnowledgeDocumentStatus =
  | 'pending'
  | 'processing'
  | 'indexed'
  | 'failed'

export type KnowledgeDocument = {
  id: string
  tenantId: string
  knowledgeBaseId: string
  title: string
  originalFilename: string
  source: string | null
  mimeType: string | null
  byteSize: number | null
  status: KnowledgeDocumentStatus
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export type DeleteKnowledgeDocumentResponse = {
  message: string
  id: string
}
