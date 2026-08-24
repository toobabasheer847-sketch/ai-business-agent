import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { masterSettingsApi } from '@/features/master-settings/api/master-settings.api'
import type { UpdateMasterSettingsRequest } from '@/features/master-settings/types/master-settings.types'

export const masterSettingsKeys = {
  all: ['master-settings'] as const,
  current: () => [...masterSettingsKeys.all, 'current'] as const,
}

export function useMasterSettings() {
  return useQuery({
    queryKey: masterSettingsKeys.current(),
    queryFn: () => masterSettingsApi.get(),
  })
}

export function useUpdateMasterSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateMasterSettingsRequest) =>
      masterSettingsApi.update(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: masterSettingsKeys.current(),
      })
      queryClient.setQueryData(masterSettingsKeys.current(), data)
    },
  })
}
