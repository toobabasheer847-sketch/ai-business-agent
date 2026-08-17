export interface PhoneNumber {
  id: string;
  tenantId: string;
  phoneNumber: string;
  label: string | null;
  provider: string;
  status: string;
  phoneSid: string | null;
  twilioSid: string | null;
  appSid: string | null;
  webhookUrl: string | null;
  /** True when auth_token is stored. The token itself is never returned. */
  hasAuthToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Internal row including authToken — never send this to the client. */
export interface PhoneNumberRow {
  id: string;
  tenantId: string;
  phoneNumber: string;
  label: string | null;
  provider: string;
  status: string;
  phoneSid: string | null;
  twilioSid: string | null;
  authToken: string | null;
  appSid: string | null;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
