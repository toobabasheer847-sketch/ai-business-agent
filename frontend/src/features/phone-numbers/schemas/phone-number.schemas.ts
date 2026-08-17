import { z } from 'zod'

import {
  PHONE_NUMBER_PROVIDERS,
  PHONE_NUMBER_STATUSES,
} from '@/features/phone-numbers/types/phone-number.types'

const e164Regex = /^\+[1-9]\d{1,14}$/

export const phoneNumberFormSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .max(50, 'Phone number must be at most 50 characters')
    .regex(e164Regex, 'Use E.164 format, e.g. +923001234567'),
  label: z
    .string()
    .max(100, 'Label must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  provider: z.enum(PHONE_NUMBER_PROVIDERS),
  status: z.enum(PHONE_NUMBER_STATUSES),
  twilioSid: z
    .string()
    .max(255, 'Account SID must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  authToken: z
    .string()
    .max(255, 'Auth Token must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  appSid: z
    .string()
    .max(255, 'App SID must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  webhookUrl: z
    .string()
    .max(2048, 'Webhook URL is too long')
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      'Webhook URL must start with http:// or https://',
    ),
})

export type PhoneNumberFormValues = z.infer<typeof phoneNumberFormSchema>

export const phoneNumberFiltersSchema = z.object({
  search: z.string().optional(),
  provider: z.enum(PHONE_NUMBER_PROVIDERS).optional().or(z.literal('')),
  status: z.enum(PHONE_NUMBER_STATUSES).optional().or(z.literal('')),
})

export type PhoneNumberFiltersValues = z.infer<typeof phoneNumberFiltersSchema>
