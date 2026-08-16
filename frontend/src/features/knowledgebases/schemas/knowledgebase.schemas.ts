import { z } from 'zod'

const optionalDescription = z.string().trim().optional().or(z.literal(''))

export const createKnowledgebaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  description: optionalDescription,
})

export type CreateKnowledgebaseFormValues = z.infer<
  typeof createKnowledgebaseSchema
>

/** Form edit schema — name stays required in the UI; PATCH body may omit fields. */
export const updateKnowledgebaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  description: optionalDescription,
})

export type UpdateKnowledgebaseFormValues = z.infer<
  typeof updateKnowledgebaseSchema
>
