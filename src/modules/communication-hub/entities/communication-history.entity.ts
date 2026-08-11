export interface CommunicationHistoryItem {
  id: string;
  tenantId: string;
  channel: 'email' | 'sms' | 'call' | 'web';
  direction: 'inbound' | 'outbound' | 'internal' | null;
  prospectId: string | null;
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
  activeConversations: number;
}
