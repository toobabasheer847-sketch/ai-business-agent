/** Matches GET/PATCH /api/tenants response */
export type Tenant = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/** Matches PATCH /api/tenants body — never include tenantId */
export type UpdateTenantRequest = {
  name?: string
}
