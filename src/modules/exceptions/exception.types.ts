export const EXCEPTION_CATEGORIES = [
  'task',
  'sales',
  'proposal',
  'communication',
  'ai_automation',
  'approval',
] as const;
export const EXCEPTION_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;
export const EXCEPTION_STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'dismissed',
] as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export type ExceptionDraft = {
  exceptionKey: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  sourceType: string;
  sourceId: string;
  recommendedAction: string;
  recommendedActionType: string;
  metadata: Record<string, unknown>;
};

export type ExceptionRecord = ExceptionDraft & {
  id: string;
  tenantId: string;
  status: ExceptionStatus;
  detectedAt: Date;
  lastDetectedAt: Date;
  occurrenceCount: number;
  priorityScore: number;
  priorityReason: string;
  assignedTo: string | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  dismissedAt: Date | null;
  dismissedBy: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExceptionQuery = {
  page: number;
  limit: number;
  offset: number;
  search?: string;
  category?: ExceptionCategory;
  severity?: ExceptionSeverity;
  status?: ExceptionStatus;
  assignedTo?: string;
  from?: Date;
  to?: Date;
  sort: 'priority' | 'detectedAt';
};

export type DetectionSnapshot = {
  now: Date;
  truncated: boolean;
  tasks: TaskEvidence[];
  leads: LeadEvidence[];
  prospects: ProspectEvidence[];
  proposals: ProposalEvidence[];
  reminders: ReminderEvidence[];
  runs: RunEvidence[];
  approvals: ApprovalEvidence[];
};

export type TaskEvidence = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  createdAt: Date;
  assignedTo: string | null;
  assigneeActive: boolean | null;
  companyId: string | null;
};

export type LeadEvidence = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  companyId: string;
};

export type ProspectEvidence = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  companyId: string;
};

export type ProposalEvidence = {
  id: string;
  title: string;
  status: string;
  sentAt: Date | null;
  viewedAt: Date | null;
  validUntil: Date | null;
};

export type ReminderEvidence = {
  id: string;
  taskId: string;
  status: string;
  attemptCount: number;
  channel: string | null;
};

export type RunEvidence = {
  id: string;
  agentName: string;
  status: string;
  durationMs: number | null;
  costStatus: string;
  startedAt: Date;
};

export type ApprovalEvidence = {
  id: string;
  title: string;
  status: string;
  actionType: string;
  createdAt: Date;
  expiresAt: Date;
};

export type DetectionConfig = {
  dueSoonHours: number;
  highPriorityOpenDays: number;
  staleOpenDays: number;
  leadUncontactedDays: number;
  prospectStaleDays: number;
  proposalNotViewedDays: number;
  proposalNoDecisionDays: number;
  proposalExpiringDays: number;
  approvalPendingHours: number;
  slowRunMs: number;
  repeatedFailureCount: number;
  lookbackDays: number;
};

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  dueSoonHours: 24,
  highPriorityOpenDays: 2,
  staleOpenDays: 14,
  leadUncontactedDays: 3,
  prospectStaleDays: 14,
  proposalNotViewedDays: 3,
  proposalNoDecisionDays: 7,
  proposalExpiringDays: 3,
  approvalPendingHours: 12,
  slowRunMs: 120_000,
  repeatedFailureCount: 3,
  lookbackDays: 7,
};

export const OPEN_STATUSES: ExceptionStatus[] = [
  'open',
  'acknowledged',
  'in_progress',
];
