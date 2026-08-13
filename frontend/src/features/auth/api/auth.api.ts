import { apiClient } from '@/lib/api'
import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/features/auth/types/auth.types'

export const authApi = {
  login(payload: LoginRequest) {
    return apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data)
  },

  register(payload: RegisterRequest) {
    return apiClient.post<RegisterResponse>('/auth/register', payload).then((r) => r.data)
  },

  me() {
    return apiClient.get<AuthenticatedUser>('/auth/me').then((r) => r.data)
  },
}
