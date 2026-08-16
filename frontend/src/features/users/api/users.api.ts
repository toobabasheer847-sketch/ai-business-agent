import { apiClient } from '@/lib/api'
import type {
  CreateUserRequest,
  DeleteUserResponse,
  UpdateUserRequest,
  User,
  UserListQuery,
} from '@/features/users/types/user.types'

function toListParams(query?: UserListQuery) {
  if (!query) return undefined

  const params: Record<string, string | boolean> = {}
  if (query.isActive !== undefined) params.isActive = query.isActive
  if (query.search?.trim()) params.search = query.search.trim()

  return Object.keys(params).length > 0 ? params : undefined
}

export const usersApi = {
  list(query?: UserListQuery) {
    return apiClient
      .get<User[]>('/users', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(id: string) {
    return apiClient.get<User>(`/users/${id}`).then((r) => r.data)
  },

  create(payload: CreateUserRequest) {
    return apiClient.post<User>('/users', payload).then((r) => r.data)
  },

  update(id: string, payload: UpdateUserRequest) {
    return apiClient.patch<User>(`/users/${id}`, payload).then((r) => r.data)
  },

  remove(id: string) {
    return apiClient
      .delete<DeleteUserResponse>(`/users/${id}`)
      .then((r) => r.data)
  },
}
