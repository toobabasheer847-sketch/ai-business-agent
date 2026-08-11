export interface Conversation {
  id: string;
  tenantId: string;
  userId: string | null;
  prospectId: string | null;
  title: string | null;
  channel: string;
  status: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  userId: string | null;
  role: string;
  content: string;
  metadata: unknown;
  tokenCount: number | null;
  createdAt: Date;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
