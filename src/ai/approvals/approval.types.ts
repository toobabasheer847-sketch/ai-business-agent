export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type ApprovalRecord = {
  id: string;
  tenantId: string;
  requesterUserId: string | null;
  approverUserId: string | null;
  agentRunId: string | null;
  agentName: string | null;
  actionType: string;
  title: string;
  description: string;
  targetEntityType: string;
  targetEntityId: string;
  proposedPayload: Record<string, unknown>;
  originalPayload: Record<string, unknown>;
  approvedPayload: Record<string, unknown> | null;
  status: ApprovalStatus;
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
  rejectionReason: string | null;
  payloadHash: string;
  expiresAt: Date;
  decidedAt: Date | null;
  executedAt: Date | null;
  executionReference: string | null;
  errorSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApprovalEvent = {
  id: string;
  approvalId: string;
  tenantId: string;
  actorUserId: string | null;
  eventType: string;
  note: string | null;
  createdAt: Date;
};

export type ApprovalScope = { tenantId: string; userId?: string };

export type ApprovalQuery = {
  page: number;
  limit: number;
  offset: number;
  status?: ApprovalStatus;
  riskLevel?: 'low' | 'medium' | 'high';
  actionType?: string;
  agentName?: string;
  requesterUserId?: string;
  from?: Date;
  to?: Date;
};

export interface ApprovalStore {
  insert(row: ApprovalRecord): Promise<ApprovalRecord>;
  expireDue(scope: ApprovalScope, now: Date): Promise<void>;
  findPendingDuplicate(tenantId: string, actionType: string, targetEntityId: string, payloadHash: string): Promise<ApprovalRecord | null>;
  find(scope: ApprovalScope, id: string): Promise<ApprovalRecord | null>;
  transition(scope: ApprovalScope, id: string, from: ApprovalStatus[], patch: Partial<ApprovalRecord>): Promise<ApprovalRecord | null>;
  list(scope: ApprovalScope, query: ApprovalQuery): Promise<{ data: ApprovalRecord[]; total: number }>;
  summary(scope: ApprovalScope): Promise<Record<ApprovalStatus, number>>;
  addEvent(event: Omit<ApprovalEvent, 'id' | 'createdAt'>): Promise<void>;
  hasEvent(approvalId: string, actorUserId: string, eventType: string): Promise<boolean>;
  events(scope: ApprovalScope, approvalId: string): Promise<ApprovalEvent[]>;
}

export type ExecutionOutcome = {
  reference: string | null;
  uncertain?: boolean;
};

export interface ApprovalExecutorRegistry {
  validate(record: ApprovalRecord): Promise<void>;
  execute(record: ApprovalRecord): Promise<ExecutionOutcome>;
}
