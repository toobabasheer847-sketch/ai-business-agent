/** Backend LeadStatus values — do not invent others */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

/** Matches GET/POST/PATCH /api/leads response — API-exposed fields only */
export type Lead = {
  id: string
  tenantId: string
  companyId: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  source: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Matches POST /api/leads body — never include tenantId */
export type CreateLeadRequest = {
  companyId: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  source?: string
  status?: LeadStatus
  notes?: string
}

/** Matches PATCH /api/leads/:id body — never include tenantId */
export type UpdateLeadRequest = {
  companyId?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  source?: string
  status?: LeadStatus
  notes?: string
}

/** Matches DELETE /api/leads/:id response */
export type DeleteLeadResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/leads */
export type LeadListQuery = {
  search?: string
  status?: LeadStatus | string
  companyId?: string
  source?: string
}
