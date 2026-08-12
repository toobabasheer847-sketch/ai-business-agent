export interface Prospect {
  id: string;
  tenantId: string;
  companyId: string;
  leadId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
