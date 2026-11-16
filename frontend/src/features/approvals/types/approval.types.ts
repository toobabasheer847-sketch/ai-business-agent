export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed' | 'expired' | 'cancelled'

export type ApprovalRecord = {
  id: string
  tenantId: string
  requesterUserId: string | null
  approverUserId: string | null
  agentRunId: string | null
  agentName: string | null
  actionType: string
  title: string
  description: string
  targetEntityType: string
  targetEntityId: string
  originalPayload: Record<string, unknown>
  approvedPayload: Record<string, unknown> | null
  status: ApprovalStatus
  riskLevel: 'low' | 'medium' | 'high'
  reason: string
  rejectionReason: string | null
  expiresAt: string
  decidedAt: string | null
  executedAt: string | null
  executionReference: string | null
  errorSummary: string | null
  createdAt: string
  updatedAt: string
}

export type ApprovalPage = { data: ApprovalRecord[]; page: number; limit: number; total: number }

export type ApprovalSummary = Record<ApprovalStatus, number>

export type ApprovalFilters = {
  status?: string
  riskLevel?: string
  actionType?: string
  agent?: string
  requesterUserId?: string
  from?: string
  to?: string
  page?: number
}
