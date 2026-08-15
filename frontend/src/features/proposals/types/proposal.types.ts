/** Backend ProposalStatus values from API DTOs — do not invent others */
export const PROPOSAL_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
] as const

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

/**
 * Matches GET/POST/PATCH /api/proposals response — API-exposed fields only.
 * tenantId and createdBy are response-only; never send them from the frontend.
 */
export type Proposal = {
  id: string
  tenantId: string
  prospectId: string
  createdBy: string | null
  title: string
  description: string | null
  status: string
  content: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Matches POST /api/proposals body.
 * Never include tenantId or createdBy (JWT provides both).
 */
export type CreateProposalRequest = {
  prospectId: string
  title: string
  description?: string
  content?: string
  status?: ProposalStatus
}

/**
 * Matches PATCH /api/proposals/:id body.
 * Never include tenantId, createdBy, or prospectId (reassignment not supported).
 */
export type UpdateProposalRequest = {
  title?: string
  description?: string
  content?: string
  status?: ProposalStatus
}

/** Matches DELETE /api/proposals/:id response */
export type DeleteProposalResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/proposals — no pagination or sort params */
export type ProposalListQuery = {
  status?: ProposalStatus | string
  prospectId?: string
  createdBy?: string
  search?: string
}
