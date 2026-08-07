export type ProposalStatus =
  | 'draft'
  | 'generated'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type ProposalTone = 'professional' | 'friendly' | 'formal' | 'concise' | 'persuasive';
export type ProposalLength = 'short' | 'medium' | 'detailed';

export interface ProposalRecord {
  id: string;
  tenantId: string;
  prospectId: string;
  createdBy?: string | null;
  title: string;
  description?: string | null;
  requirements?: string | null;
  status: ProposalStatus;
  price?: string | number | null;
  currency: string;
  validUntil?: Date | string | null;
  content?: string | null;
  sentAt?: Date | string | null;
  viewedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface ProposalContext {
  userId: string;
  tenantId: string;
  email?: string;
}

export interface ProposalAgentResponse {
  action: 'create' | 'get' | 'list' | 'update' | 'generate' | 'change_status';
  data: ProposalRecord | ProposalRecord[] | null;
  message?: string;
}

export interface ProspectContext {
  id: string;
  tenantId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status?: string | null;
  notes?: string | null;
}

export interface CompanyContext {
  id: string;
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
}

export interface LeadContext {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  source?: string | null;
  status?: string | null;
  notes?: string | null;
}

export interface BrandContext {
  id: string;
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  apiUrl?: string | null;
  phone?: string | null;
}

export interface KnowledgeContextItem {
  id: string;
  name: string;
  description?: string | null;
}

export interface ProposalGenerationContext {
  prospect: ProspectContext;
  company: CompanyContext;
  lead?: LeadContext | null;
  brand?: BrandContext | null;
  knowledgeBases: KnowledgeContextItem[];
}
