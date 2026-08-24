import { z } from 'zod'

/**
 * Schema for creating a Gmail configuration.
 * Email is required; OAuth fields are optional (can be provided or set later).
 */
export const createGmailConfigurationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type CreateGmailConfigurationFormValues = z.infer<
  typeof createGmailConfigurationSchema
>

/**
 * Schema for updating a Gmail configuration.
 * All fields are optional (partial update).
 */
export const updateGmailConfigurationSchema = z.object({
  email: z
    .string()
    .email('Must be a valid email address')
    .optional()
    .or(z.literal('')),
  clientId: z.string().optional().or(z.literal('')),
  clientSecret: z.string().optional().or(z.literal('')),
  accessToken: z.string().optional().or(z.literal('')),
  refreshToken: z.string().optional().or(z.literal('')),
  tokenExpiry: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type UpdateGmailConfigurationFormValues = z.infer<
  typeof updateGmailConfigurationSchema
>
