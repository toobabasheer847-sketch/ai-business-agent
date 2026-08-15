import { apiClient } from '@/lib/api'
import type {
  Tenant,
  UpdateTenantRequest,
} from '@/features/tenant/types/tenant.types'

export const tenantApi = {
  getCurrent() {
    return apiClient.get<Tenant>('/tenants').then((r) => r.data)
  },

  update(payload: UpdateTenantRequest) {
    return apiClient.patch<Tenant>('/tenants', payload).then((r) => r.data)
  },
}
