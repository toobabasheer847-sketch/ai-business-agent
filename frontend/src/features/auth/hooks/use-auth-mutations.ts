import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/use-auth'
import type { LoginRequest, RegisterRequest } from '@/features/auth/types/auth.types'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

export function useMeQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => authApi.me(),
    enabled,
    retry: false,
  })
}

export function useLoginMutation() {
  const { login } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: LoginRequest) => {
      await login(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}

export function useRegisterMutation() {
  const { register } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      await register(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}
