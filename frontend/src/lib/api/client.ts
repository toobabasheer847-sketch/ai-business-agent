import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { API_URL, AUTH_TOKEN_KEY } from '@/lib/constants/app'
import { normalizeApiError } from '@/lib/api/errors'

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000,
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0
    const path = error.config?.url
    const normalized = normalizeApiError(error.response?.data, status, path)

    if (status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return Promise.reject(normalized)
  },
)

export async function checkApiHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, status } = await apiClient.get<string>('/')
    return {
      ok: status >= 200 && status < 300,
      message: typeof data === 'string' ? data : 'Backend reachable',
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Backend unreachable',
    }
  }
}
