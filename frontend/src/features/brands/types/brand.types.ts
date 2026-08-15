/** Matches GET/POST/PATCH /api/brands response */
export type Brand = {
  id: string
  tenantId: string
  name: string
  logoUrl: string | null
  domain: string | null
  apiUrl: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

/** Matches POST /api/brands body — never include tenantId */
export type CreateBrandRequest = {
  name: string
  logoUrl?: string
  domain?: string
  apiUrl?: string
  phone?: string
}

/** Matches PATCH /api/brands/:id body — never include tenantId */
export type UpdateBrandRequest = {
  name?: string
  logoUrl?: string
  domain?: string
  apiUrl?: string
  phone?: string
}

export type DeleteBrandResponse = {
  message: string
  id: string
}
