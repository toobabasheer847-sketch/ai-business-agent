import { apiClient } from '@/lib/api'
import type { ExceptionFilters, ExceptionPage, ExceptionRecord, ExceptionSummary } from '@/features/exceptions/types/exception.types'

function params(filters: ExceptionFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''))
}

export const exceptionsApi = {
  summary: async () => (await apiClient.get<ExceptionSummary>('/exceptions/summary')).data,
  attention: async () => (await apiClient.get<ExceptionRecord[]>('/exceptions/attention')).data,
  list: async (filters: ExceptionFilters) => (await apiClient.get<ExceptionPage>('/exceptions', { params: params(filters) })).data,
  find: async (id: string) => (await apiClient.get<ExceptionRecord>(`/exceptions/${id}`)).data,
  detect: async () => (await apiClient.post<{ created: number; updated: number; resolved: number; schedulerAvailable: boolean; sendsMessages: false }>('/exceptions/detect')).data,
  acknowledge: async (id: string) => (await apiClient.patch<ExceptionRecord>(`/exceptions/${id}/acknowledge`)).data,
  assign: async (id: string, userId: string) => (await apiClient.patch<ExceptionRecord>(`/exceptions/${id}/assign`, { userId })).data,
  status: async (id: string, status: 'acknowledged' | 'in_progress') => (await apiClient.patch<ExceptionRecord>(`/exceptions/${id}/status`, { status })).data,
  resolve: async (id: string, note?: string) => (await apiClient.patch<ExceptionRecord>(`/exceptions/${id}/resolve`, { note })).data,
  dismiss: async (id: string, reason: string) => (await apiClient.patch<ExceptionRecord>(`/exceptions/${id}/dismiss`, { reason })).data,
}
