import { z } from 'zod'

import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
  MESSAGE_ROLES,
} from '@/features/conversations/types/conversation.types'

const optionalProspectId = z
  .string()
  .uuid('Select a valid prospect')
  .optional()
  .or(z.literal(''))

const optionalTitle = z
  .string()
  .trim()
  .max(255, 'Title must be at most 255 characters')
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || value.length > 0, 'Title cannot be empty')

const optionalSummary = z.string().trim().optional().or(z.literal(''))

const optionalChannel = z.enum(CONVERSATION_CHANNELS).optional()

const optionalStatus = z.enum(CONVERSATION_STATUSES).optional()

export const createConversationSchema = z.object({
  prospectId: optionalProspectId,
  title: optionalTitle,
  channel: optionalChannel,
  summary: optionalSummary,
})

export type CreateConversationFormValues = z.infer<
  typeof createConversationSchema
>

export const updateConversationSchema = z.object({
  title: optionalTitle,
  channel: optionalChannel,
  status: optionalStatus,
  summary: optionalSummary,
})

export type UpdateConversationFormValues = z.infer<
  typeof updateConversationSchema
>

export const createMessageSchema = z.object({
  conversationId: z.string().uuid('Conversation is required'),
  role: z.enum(MESSAGE_ROLES, { message: 'Select a message role' }),
  content: z.string().trim().min(1, 'Content is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().min(0, 'Token count must be 0 or greater').optional(),
})

export type CreateMessageFormValues = z.infer<typeof createMessageSchema>

export const createNestedMessageSchema = z.object({
  role: z.enum(MESSAGE_ROLES, { message: 'Select a message role' }),
  content: z.string().trim().min(1, 'Content is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().min(0, 'Token count must be 0 or greater').optional(),
})

export type CreateNestedMessageFormValues = z.infer<
  typeof createNestedMessageSchema
>

export const updateMessageSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().min(0, 'Token count must be 0 or greater').optional(),
})

export type UpdateMessageFormValues = z.infer<typeof updateMessageSchema>
