import { z } from 'zod'

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

const optionalAiModel = z
  .string()
  .trim()
  .max(100, 'AI model must be at most 100 characters')
  .optional()
  .or(z.literal(''))

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
