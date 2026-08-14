export const PHONE_NUMBER_PROVIDERS = ['twilio', 'vonage', 'custom'] as const
export const PHONE_NUMBER_STATUSES = [
  'active',
  'inactive',
  'pending',
  'suspended',
] as const

export type PhoneNumberProvider = (typeof PHONE_NUMBER_PROVIDERS)[number]
export type PhoneNumberStatus = (typeof PHONE_NUMBER_STATUSES)[number]

/** Matches backend PhoneNumber entity / repository returning columns */
export type PhoneNumber = {
  id: string
  tenantId: string
  phoneNumber: string
  label: string | null
  provider: string
  status: string
  createdAt: string
  updatedAt: string
}

export type CreatePhoneNumberPayload = {
  phoneNumber: string
  label?: string
  provider?: PhoneNumberProvider
  status?: PhoneNumberStatus
}

export type UpdatePhoneNumberPayload = {
  phoneNumber?: string
  label?: string
  provider?: PhoneNumberProvider
  status?: PhoneNumberStatus
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
    webhooks?: {
      voiceUrl: string
      smsUrl: string
      statusCallback: string
    }
  }
}
