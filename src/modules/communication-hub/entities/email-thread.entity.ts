export interface EmailThread {
  id: string;
  tenantId: string;
  prospectId: string | null;
  title: string | null;
  status: string;
  summary: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
