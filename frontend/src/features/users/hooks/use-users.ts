import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usersApi } from '@/features/users/api/users.api'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserListQuery,
} from '@/features/users/types/user.types'

function normalizeListQuery(query?: UserListQuery): UserListQuery | undefined {
  if (!query) return undefined

  const normalized: UserListQuery = {
    isActive: query.isActive,
    search: query.search?.trim() || undefined,
  }

  if (normalized.isActive === undefined && !normalized.search) {
    return undefined
  }

  return normalized
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (query?: UserListQuery) =>
    [...userKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
}

export function useUsers(query?: UserListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: userKeys.list(normalized),
    queryFn: () => usersApi.list(normalized),
  })
}

export function useUser(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => usersApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateUserRequest) => usersApi.create(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.setQueryData(userKeys.detail(data.id), data)
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateUserRequest
    }) => usersApi.update(id, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      await queryClient.invalidateQueries({
        queryKey: userKeys.detail(data.id),
      })
      queryClient.setQueryData(userKeys.detail(data.id), data)
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.removeQueries({ queryKey: userKeys.detail(id) })
    },
  })
}
