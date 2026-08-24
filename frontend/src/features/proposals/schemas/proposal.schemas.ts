import { z } from 'zod'

import { PROPOSAL_STATUSES } from '@/features/proposals/types/proposal.types'

const optionalDescription = z.string().trim().optional().or(z.literal(''))

const optionalContent = z.string().trim().optional().or(z.literal(''))

const optionalStatus = z.enum(PROPOSAL_STATUSES).optional()

export const createProposalSchema = z.object({
  prospectId: z.string().uuid('Select a prospect'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters'),
  description: optionalDescription,
  content: optionalContent,
  status: optionalStatus,
})

export type CreateProposalFormValues = z.infer<typeof createProposalSchema>

export const updateProposalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters')
    .optional(),
  description: optionalDescription,
  content: optionalContent,
  status: optionalStatus,
})

export type UpdateProposalFormValues = z.infer<typeof updateProposalSchema>
