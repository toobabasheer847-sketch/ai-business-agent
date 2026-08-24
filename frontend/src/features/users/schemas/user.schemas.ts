import { z } from 'zod'

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  isActive: z.boolean().optional(),
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || value.length >= 8,
      'Password must be at least 8 characters',
    ),
  isActive: z.boolean().optional(),
})

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
