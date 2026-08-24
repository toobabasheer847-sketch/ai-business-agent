/** Matches GET/POST/PATCH /api/knowledgebases response — API-exposed fields only */
export type Knowledgebase = {
  id: string
  tenantId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/** Matches POST /api/knowledgebases body — never include tenantId */
export type CreateKnowledgebaseRequest = {
  name: string
  description?: string
}

/** Matches PATCH /api/knowledgebases/:id body — never include tenantId */
export type UpdateKnowledgebaseRequest = {
  name?: string
  description?: string
}

/** Matches DELETE /api/knowledgebases/:id response */
export type DeleteKnowledgebaseResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/knowledgebases */
export type KnowledgebaseListQuery = {
  search?: string
}
