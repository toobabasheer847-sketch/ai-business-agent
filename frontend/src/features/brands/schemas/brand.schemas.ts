import { z } from 'zod'

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || /^https?:\/\/.+/i.test(value),
    'URL must start with http:// or https://',
  )

const optionalDomain = z
  .string()
  .trim()
  .max(255, 'Domain must be at most 255 characters')
  .optional()
  .or(z.literal(''))

const optionalPhone = z
  .string()
  .trim()
  .max(50, 'Phone must be at most 50 characters')
  .optional()
  .or(z.literal(''))

export const createBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  logoUrl: optionalUrl,
  domain: optionalDomain,
  apiUrl: optionalUrl,
  phone: optionalPhone,
})

export type CreateBrandFormValues = z.infer<typeof createBrandSchema>

export const updateBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  logoUrl: optionalUrl,
  domain: optionalDomain,
  apiUrl: optionalUrl,
  phone: optionalPhone,
})

export type UpdateBrandFormValues = z.infer<typeof updateBrandSchema>
