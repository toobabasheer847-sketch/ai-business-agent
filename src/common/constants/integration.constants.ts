export const CHANNELS = {
  WEB: 'web',
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  LOST: 'lost',
} as const;

export const PROSPECT_STATUS = {
  NEW: 'new',
  ENGAGED: 'engaged',
  CONVERTED: 'converted',
  LOST: 'lost',
} as const;

export const PROPOSAL_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
