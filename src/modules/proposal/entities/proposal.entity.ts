export interface Proposal {
  id: string;
  tenantId: string;
  prospectId: string;
  createdBy: string | null;
  title: string;
  description: string | null;
  status: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
}
