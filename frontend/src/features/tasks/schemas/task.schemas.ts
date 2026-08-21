import { z } from 'zod'

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/features/tasks/types/task.types'

const optionalDescription = z.string().trim().optional().or(z.literal(''))

const optionalAssignedTo = z
  .string()
  .uuid('Select a valid user')
  .optional()
  .or(z.literal(''))

const optionalDueAt = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !value || !Number.isNaN(new Date(value).getTime()),
    'Enter a valid due date',
  )

const optionalCrmId = z
  .string()
  .uuid('Select a valid CRM record')
  .optional()
  .or(z.literal(''))

const titleSchema = z
  .string()
  .trim()
  .min(3, 'Title must be at least 3 characters')
  .max(255, 'Title must be at most 255 characters')

export const createTaskSchema = z.object({
  title: titleSchema,
  description: optionalDescription,
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: optionalAssignedTo,
  companyId: optionalCrmId,
  prospectId: optionalCrmId,
  leadId: optionalCrmId,
  dueAt: optionalDueAt,
})

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z.object({
  title: titleSchema,
  description: optionalDescription,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: optionalAssignedTo,
  companyId: optionalCrmId,
  prospectId: optionalCrmId,
  leadId: optionalCrmId,
  dueAt: optionalDueAt,
})

export type UpdateTaskFormValues = z.infer<typeof updateTaskSchema>
