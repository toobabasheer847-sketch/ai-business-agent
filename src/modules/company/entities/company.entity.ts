export interface Company {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
