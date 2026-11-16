import { apiClient } from '@/lib/api'
import type { ApprovalFilters, ApprovalPage, ApprovalRecord, ApprovalSummary } from '@/features/approvals/types/approval.types'

function params(filters: ApprovalFilters) {
  return {
    status: filters.status || undefined,
    riskLevel: filters.riskLevel || undefined,
    actionType: filters.actionType || undefined,
    agent: filters.agent || undefined,
    requesterUserId: filters.requesterUserId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page: filters.page,
    limit: 20,
    sort: 'createdAt',
    direction: 'desc',
  }
}

export const approvalsApi = {
  summary: async () => (await apiClient.get<ApprovalSummary>('/ai-approvals/summary')).data,
  list: async (filters: ApprovalFilters) => (await apiClient.get<ApprovalPage>('/ai-approvals', { params: params(filters) })).data,
  find: async (id: string) => (await apiClient.get<ApprovalRecord>(`/ai-approvals/${id}`)).data,
  events: async (id: string) => (await apiClient.get<Array<{ id: string; eventType: string; note: string | null; createdAt: string }>>(`/ai-approvals/${id}/events`)).data,
  approve: async (id: string) => (await apiClient.post<ApprovalRecord>(`/ai-approvals/${id}/approve`)).data,
  editApprove: async (id: string, edits: Record<string, string>) => (await apiClient.post<ApprovalRecord>(`/ai-approvals/${id}/edit-approve`, { edits })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<ApprovalRecord>(`/ai-approvals/${id}/reject`, { reason })).data,
  cancel: async (id: string) => (await apiClient.post<ApprovalRecord>(`/ai-approvals/${id}/cancel`)).data,
}
