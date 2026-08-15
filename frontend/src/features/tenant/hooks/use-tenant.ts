import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { tenantApi } from '@/features/tenant/api/tenant.api'
import type { UpdateTenantRequest } from '@/features/tenant/types/tenant.types'

export const tenantKeys = {
  all: ['tenants'] as const,
  current: () => [...tenantKeys.all, 'current'] as const,
}

export function useTenant() {
  return useQuery({
    queryKey: tenantKeys.current(),
    queryFn: () => tenantApi.getCurrent(),
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateTenantRequest) => tenantApi.update(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: tenantKeys.current() })
      queryClient.setQueryData(tenantKeys.current(), data)
    },
  })
}
