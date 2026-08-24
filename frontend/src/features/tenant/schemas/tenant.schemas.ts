import { z } from 'zod'

export const updateTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters'),
})

export type UpdateTenantFormValues = z.infer<typeof updateTenantSchema>
