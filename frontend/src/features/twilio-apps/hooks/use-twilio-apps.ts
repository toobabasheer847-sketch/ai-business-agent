import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { twilioAppsApi } from '@/features/twilio-apps/api/twilio-apps.api'
import type {
  CreateTwilioAppPayload,
  TwilioAppQuery,
  UpdateTwilioAppPayload,
} from '@/features/twilio-apps/types/twilio-app.types'

export const twilioAppKeys = {
  all: ['twilio-apps'] as const,
  lists: () => [...twilioAppKeys.all, 'list'] as const,
  list: (query?: TwilioAppQuery) =>
    [...twilioAppKeys.lists(), query ?? {}] as const,
  details: () => [...twilioAppKeys.all, 'detail'] as const,
  detail: (id: string) => [...twilioAppKeys.details(), id] as const,
}

export function useTwilioApps(query?: TwilioAppQuery) {
  return useQuery({
    queryKey: twilioAppKeys.list(query),
    queryFn: () => twilioAppsApi.list(query),
  })
}

export function useTwilioApp(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: twilioAppKeys.detail(id ?? ''),
    queryFn: () => twilioAppsApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateTwilioApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateTwilioAppPayload) =>
      twilioAppsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: twilioAppKeys.lists() })
    },
  })
}

export function useUpdateTwilioApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateTwilioAppPayload
    }) => twilioAppsApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: twilioAppKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: twilioAppKeys.detail(data.id),
      })
    },
  })
}

export function useDeleteTwilioApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => twilioAppsApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: twilioAppKeys.lists() })
      queryClient.removeQueries({ queryKey: twilioAppKeys.detail(id) })
    },
  })
}
