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

const optionalIndustry = z
  .string()
  .trim()
  .max(255, 'Industry must be at most 255 characters')
  .optional()
  .or(z.literal(''))

const optionalDescription = z.string().trim().optional().or(z.literal(''))

export const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  domain: optionalDomain,
  website: optionalUrl,
  industry: optionalIndustry,
  description: optionalDescription,
})

export type CreateCompanyFormValues = z.infer<typeof createCompanySchema>

/** Form edit schema — name stays required in the UI; PATCH body may omit fields. */
export const updateCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  domain: optionalDomain,
  website: optionalUrl,
  industry: optionalIndustry,
  description: optionalDescription,
})

export type UpdateCompanyFormValues = z.infer<typeof updateCompanySchema>
