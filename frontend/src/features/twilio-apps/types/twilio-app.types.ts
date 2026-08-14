export const TWILIO_APP_STATUSES = [
  'active',
  'inactive',
  'pending',
  'error',
] as const

export type TwilioAppStatus = (typeof TWILIO_APP_STATUSES)[number]

/** Matches backend Twilio App repository returning columns */
export type TwilioApp = {
  id: string
  tenantId: string
  phoneNumberId: string
  accountSid: string
  authToken: string
  appSid: string | null
  webhookUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export type CreateTwilioAppPayload = {
  phoneNumberId: string
  accountSid: string
  authToken: string
  appSid?: string
  webhookUrl?: string
  status?: TwilioAppStatus
}

export type UpdateTwilioAppPayload = {
  phoneNumberId?: string
  accountSid?: string
  authToken?: string
  appSid?: string
  webhookUrl?: string
  status?: TwilioAppStatus
}

export type TwilioAppQuery = {
  phoneNumberId?: string
  status?: TwilioAppStatus
  search?: string
}

export type DeleteTwilioAppResponse = {
  message: string
  id: string
}
