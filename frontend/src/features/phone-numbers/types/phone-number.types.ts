export const PHONE_NUMBER_PROVIDERS = ['twilio', 'vonage', 'custom'] as const
export const PHONE_NUMBER_STATUSES = [
  'active',
  'inactive',
  'pending',
  'suspended',
] as const

export type PhoneNumberProvider = (typeof PHONE_NUMBER_PROVIDERS)[number]
export type PhoneNumberStatus = (typeof PHONE_NUMBER_STATUSES)[number]

/** Matches backend PhoneNumber public response — authToken is never included. */
export type PhoneNumber = {
  id: string
  tenantId: string
  phoneNumber: string
  label: string | null
  provider: string
  status: string
  phoneSid: string | null
  twilioSid: string | null
  appSid: string | null
  webhookUrl: string | null
  hasAuthToken: boolean
  createdAt: string
  updatedAt: string
}

export type CreatePhoneNumberPayload = {
  phoneNumber: string
  label?: string
  provider?: PhoneNumberProvider
  status?: PhoneNumberStatus
  phoneSid?: string
  twilioSid?: string
  authToken?: string
  appSid?: string
  webhookUrl?: string
}

export type UpdatePhoneNumberPayload = {
  phoneNumber?: string
  label?: string
  provider?: PhoneNumberProvider
  status?: PhoneNumberStatus
  phoneSid?: string
  twilioSid?: string
  authToken?: string
  appSid?: string
  webhookUrl?: string
}

export type PhoneNumberQuery = {
  provider?: PhoneNumberProvider
  status?: PhoneNumberStatus
  search?: string
}

export type DeletePhoneNumberResponse = {
  message: string
  id: string
}

export type AvailableNumberType = 'local' | 'tollFree'

export type AvailablePhoneNumbersQuery = {
  countryCode?: string
  locality?: string
  areaCode?: number
  contains?: string
  type?: AvailableNumberType
  limit?: number
}

export type AvailablePhoneNumber = {
  phoneNumber: string
  friendlyName: string | null
  locality: string | null
  region: string | null
  postalCode: string | null
  isoCountry: string | null
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
  addressRequirements: string | null
  beta: boolean
  type: AvailableNumberType
}

export type BuyPhoneNumberPayload = {
  phoneNumber: string
  label?: string
  locality?: string
  region?: string
  countryCode?: string
}

export type BoughtPhoneNumber = PhoneNumber & {
  purchase?: {
    sid: string
    status: string | null
    friendlyName: string | null
  }
}
