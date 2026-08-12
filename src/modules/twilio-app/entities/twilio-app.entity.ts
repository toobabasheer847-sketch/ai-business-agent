export interface TwilioApp {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  accountSid: string;
  authToken: string;
  appSid: string | null;
  webhookUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
