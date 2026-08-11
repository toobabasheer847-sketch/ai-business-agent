export interface Brand {
  id: string;
  tenantId: string;
  name: string;
  logoUrl: string | null;
  domain: string | null;
  apiUrl: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}
