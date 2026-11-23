import { apiClient } from '@/lib/api'
import type { GenerationResult, WorkflowExecution, WorkflowRecord, WorkflowSummary } from '@/features/workflows/types/workflow.types'

export const workflowsApi = {
  summary: async () => (await apiClient.get<WorkflowSummary>('/workflows/summary')).data,
  list: async (params: { page?: number; status?: string; search?: string }) =>
    (await apiClient.get<{ data: WorkflowRecord[]; total: number }>('/workflows', { params })).data,
  generate: async (instruction: string) =>
    (await apiClient.post<GenerationResult>('/workflows/generate', { instruction })).data,
  create: async (payload: { name: string; description?: string; definition: unknown }) =>
    (await apiClient.post<WorkflowRecord>('/workflows', payload)).data,
  find: async (id: string) => (await apiClient.get<WorkflowRecord>(`/workflows/${id}`)).data,
  update: async (id: string, payload: { name?: string; description?: string; definition?: unknown }) =>
    (await apiClient.patch<WorkflowRecord>(`/workflows/${id}`, payload)).data,
  activate: async (id: string) => (await apiClient.post<WorkflowRecord>(`/workflows/${id}/activate`)).data,
  pause: async (id: string) => (await apiClient.post<WorkflowRecord>(`/workflows/${id}/pause`)).data,
  resume: async (id: string) => (await apiClient.post<WorkflowRecord>(`/workflows/${id}/resume`)).data,
  execute: async (id: string) => (await apiClient.post<WorkflowExecution>(`/workflows/${id}/execute`)).data,
  executions: async (id: string) =>
    (await apiClient.get<{ data: WorkflowExecution[]; total: number }>(`/workflows/${id}/executions`)).data,
  execution: async (id: string) => (await apiClient.get<WorkflowExecution>(`/workflow-executions/${id}`)).data,
  cancel: async (id: string) => (await apiClient.post<WorkflowExecution>(`/workflow-executions/${id}/cancel`)).data,
}
