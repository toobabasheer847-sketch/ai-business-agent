export interface PhoneNumber {
  id: string;
  tenantId: string;
  phoneNumber: string;
  label: string | null;
  provider: string;
  status: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
