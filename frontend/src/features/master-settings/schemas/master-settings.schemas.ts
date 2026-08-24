import { z } from 'zod'

/** Mirrors backend ALLOWED_AI_MODELS — keep in sync with src/ai/context/allowed-ai-models.ts */
export const ALLOWED_AI_MODELS = [
  'gemini-3.6-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro-001',
] as const

const SYSTEM_DEFAULT_AI_MODEL = '__system_default__'

const optionalEmail = z
  .string()
  .trim()
  .max(255, 'Notification email must be at most 255 characters')
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || z.email().safeParse(value).success,
    'Enter a valid email address',
  )

const optionalAiModel = z.enum([
  SYSTEM_DEFAULT_AI_MODEL,
  ...ALLOWED_AI_MODELS,
])

export const updateMasterSettingsSchema = z
  .object({
    defaultLanguage: z
      .string()
      .trim()
      .min(1, 'Language is required')
      .max(10, 'Language must be at most 10 characters'),
    defaultTimezone: z
      .string()
      .trim()
      .min(1, 'Timezone is required')
      .max(100, 'Timezone must be at most 100 characters'),
    defaultCurrency: z
      .string()
      .trim()
      .min(1, 'Currency is required')
      .max(3, 'Currency must be at most 3 characters'),
    aiModel: optionalAiModel,
    maxConversationHistory: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must be at least 1')
      .max(100, 'Must be at most 100'),
    enableNotifications: z.boolean(),
    notificationEmail: optionalEmail,
    businessHoursStart: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Must be between 0 and 23')
      .max(23, 'Must be between 0 and 23'),
    businessHoursEnd: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Must be between 0 and 23')
      .max(23, 'Must be between 0 and 23'),
    isActive: z.boolean(),
  })
  .refine(
    (values) => values.businessHoursStart < values.businessHoursEnd,
    {
      message: 'Business hours start must be before end',
      path: ['businessHoursEnd'],
    },
  )

export type UpdateMasterSettingsFormValues = z.infer<
  typeof updateMasterSettingsSchema
>

export { SYSTEM_DEFAULT_AI_MODEL }
