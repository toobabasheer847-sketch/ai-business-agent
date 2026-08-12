export interface PhoneNumber {
  id: string;
  tenantId: string;
  phoneNumber: string;
  label: string | null;
  provider: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
