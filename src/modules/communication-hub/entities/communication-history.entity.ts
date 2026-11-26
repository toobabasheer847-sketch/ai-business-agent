export interface CommunicationHistoryItem {
  id: string;
  tenantId: string;
  channel: 'email' | 'sms' | 'call' | 'web' | 'whatsapp';
  direction: 'inbound' | 'outbound' | 'internal' | null;
  prospectId: string | null;
  leadId?: string | null;
  assignedUserId?: string | null;
  title: string | null;
  summary: string | null;
  status: string;
  participantCount: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationStats {
  totalConversations: number;
  emailConversations: number;
  smsConversations: number;
  callConversations: number;
  webConversations: number;
  whatsappConversations: number;
  activeConversations: number;
}
