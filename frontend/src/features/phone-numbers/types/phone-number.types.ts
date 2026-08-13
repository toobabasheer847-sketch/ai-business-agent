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
