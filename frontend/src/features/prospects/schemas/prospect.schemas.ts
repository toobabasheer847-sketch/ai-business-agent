import { z } from 'zod'

import { PROSPECT_STATUSES } from '@/features/prospects/types/prospect.types'

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

const optionalNotes = z.string().trim().optional().or(z.literal(''))

const optionalStatus = z.enum(PROSPECT_STATUSES).optional()

export const createProspectSchema = z.object({
  companyId: z.string().uuid('Select a company'),
  leadId: z.string().uuid('Select a lead'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: optionalLastName,
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalJobTitle,
  status: optionalStatus,
  notes: optionalNotes,
})

export type CreateProspectFormValues = z.infer<typeof createProspectSchema>

export const updateProspectSchema = z.object({
  companyId: z.string().uuid('Select a company').optional(),
  leadId: z.string().uuid('Select a lead').optional(),
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
  status: optionalStatus,
  notes: optionalNotes,
})

export type UpdateProspectFormValues = z.infer<typeof updateProspectSchema>
