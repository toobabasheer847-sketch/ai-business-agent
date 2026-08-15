import { z } from 'zod'

import { LEAD_STATUSES } from '@/features/leads/types/lead.types'

const optionalLastName = z
  .string()
  .trim()
  .max(100, 'Last name must be at most 100 characters')
  .optional()
  .or(z.literal(''))

const optionalEmail = z
  .string()
  .trim()
  .max(255, 'Email must be at most 255 characters')
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Enter a valid email address',
  )

const optionalPhone = z
  .string()
  .trim()
  .max(50, 'Phone must be at most 50 characters')
  .optional()
  .or(z.literal(''))

const optionalJobTitle = z
  .string()
  .trim()
  .max(255, 'Job title must be at most 255 characters')
  .optional()
  .or(z.literal(''))

const optionalSource = z
  .string()
  .trim()
  .max(100, 'Source must be at most 100 characters')
  .optional()
  .or(z.literal(''))

const optionalNotes = z.string().trim().optional().or(z.literal(''))

const optionalStatus = z.enum(LEAD_STATUSES).optional()

export const createLeadSchema = z.object({
  companyId: z.string().uuid('Select a company'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: optionalLastName,
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalJobTitle,
  source: optionalSource,
  status: optionalStatus,
  notes: optionalNotes,
})

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>

export const updateLeadSchema = z.object({
  companyId: z.string().uuid('Select a company').optional(),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters')
    .optional(),
  lastName: optionalLastName,
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalJobTitle,
  source: optionalSource,
  status: optionalStatus,
  notes: optionalNotes,
})

export type UpdateLeadFormValues = z.infer<typeof updateLeadSchema>
