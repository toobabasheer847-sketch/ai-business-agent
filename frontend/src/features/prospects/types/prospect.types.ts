/** Backend ProspectStatus values — do not invent others */
export const PROSPECT_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
] as const

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]

/** Matches GET/POST/PATCH /api/prospects response — API-exposed fields only */
export type Prospect = {
  id: string
  tenantId: string
  companyId: string
  leadId: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Matches POST /api/prospects body — never include tenantId */
export type CreateProspectRequest = {
  companyId: string
  leadId: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  status?: ProspectStatus
  notes?: string
}

/** Matches PATCH /api/prospects/:id body — never include tenantId */
export type UpdateProspectRequest = {
  companyId?: string
  leadId?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  status?: ProspectStatus
  notes?: string
}

/** Matches DELETE /api/prospects/:id response */
export type DeleteProspectResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/prospects */
export type ProspectListQuery = {
  search?: string
  status?: ProspectStatus | string
  companyId?: string
  leadId?: string
}
