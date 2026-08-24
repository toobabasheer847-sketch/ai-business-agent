import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { gmailConfigurationApi } from '@/features/gmail-configuration/api/gmail-configuration.api'
import type {
  CreateGmailConfigurationRequest,
  UpdateGmailConfigurationRequest,
} from '@/features/gmail-configuration/types/gmail-configuration.types'

export const gmailConfigurationKeys = {
  all: ['gmail-configuration'] as const,
  configuration: () => [...gmailConfigurationKeys.all, 'configuration'] as const,
}

/**
 * Query hook for fetching the current tenant's Gmail configuration.
 * 404 (no config yet) is returned as null so the page can show an empty state.
 */
export function useGmailConfiguration(enabled = true) {
  return useQuery({
    queryKey: gmailConfigurationKeys.configuration(),
    queryFn: () => gmailConfigurationApi.getConfiguration(),
    enabled,
  })
}

/**
 * Mutation hook for creating a Gmail configuration.
 */
export function useCreateGmailConfiguration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateGmailConfigurationRequest) =>
      gmailConfigurationApi.createConfiguration(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(gmailConfigurationKeys.configuration(), data)
    },
  })
}

/**
 * Mutation hook for updating a Gmail configuration.
 */
export function useUpdateGmailConfiguration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateGmailConfigurationRequest) =>
      gmailConfigurationApi.updateConfiguration(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(gmailConfigurationKeys.configuration(), data)
    },
  })
}

/**
 * Mutation hook for deactivating a Gmail configuration.
 */
export function useDeactivateGmailConfiguration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => gmailConfigurationApi.deactivateConfiguration(),
    onSuccess: (data) => {
      queryClient.setQueryData(gmailConfigurationKeys.configuration(), data)
    },
  })
}

/**
 * Mutation hook for deleting a Gmail configuration.
 */
export function useDeleteGmailConfiguration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => gmailConfigurationApi.deleteConfiguration(),
    onSuccess: () => {
      queryClient.setQueryData(gmailConfigurationKeys.configuration(), null)
    },
  })
}
