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
