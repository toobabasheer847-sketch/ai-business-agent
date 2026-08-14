import { z } from 'zod'

import { TWILIO_APP_STATUSES } from '@/features/twilio-apps/types/twilio-app.types'

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || /^https?:\/\/.+/i.test(value),
    'Webhook URL must start with http:// or https://',
  )

export const createTwilioAppSchema = z.object({
  phoneNumberId: z.string().uuid('Select a phone number'),
  accountSid: z
    .string()
    .trim()
    .min(1, 'Account SID is required')
    .max(255, 'Account SID must be at most 255 characters'),
  authToken: z.string().trim().min(1, 'Auth Token is required'),
  appSid: z
    .string()
    .trim()
    .max(255, 'App SID must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  webhookUrl: optionalUrl,
  status: z.enum(TWILIO_APP_STATUSES),
})

export type CreateTwilioAppFormValues = z.infer<typeof createTwilioAppSchema>

/** Auth token optional on edit — leave blank to keep existing token. */
export const updateTwilioAppSchema = z.object({
  phoneNumberId: z.string().uuid('Select a phone number'),
  accountSid: z
    .string()
    .trim()
    .min(1, 'Account SID is required')
    .max(255, 'Account SID must be at most 255 characters'),
  authToken: z.string().trim().optional().or(z.literal('')),
  appSid: z
    .string()
    .trim()
    .max(255, 'App SID must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  webhookUrl: optionalUrl,
  status: z.enum(TWILIO_APP_STATUSES),
})

export type UpdateTwilioAppFormValues = z.infer<typeof updateTwilioAppSchema>
