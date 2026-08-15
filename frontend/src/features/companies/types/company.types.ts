/** Matches GET/POST/PATCH /api/companies response — API-exposed fields only */
export type Company = {
  id: string
  tenantId: string
  name: string
  domain: string | null
  website: string | null
  industry: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

/** Matches POST /api/companies body — never include tenantId */
export type CreateCompanyRequest = {
  name: string
  domain?: string
  website?: string
  industry?: string
  description?: string
}

/** Matches PATCH /api/companies/:id body — never include tenantId */
export type UpdateCompanyRequest = {
  name?: string
  domain?: string
  website?: string
  industry?: string
  description?: string
}

/** Matches DELETE /api/companies/:id response */
export type DeleteCompanyResponse = {
  message: string
  id: string
}
