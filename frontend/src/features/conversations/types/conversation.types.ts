/** Backend ConversationChannel values — do not invent others */
export const CONVERSATION_CHANNELS = ['web', 'email', 'sms', 'call'] as const

export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number]

/** Backend ConversationStatus values — do not invent others */
export const CONVERSATION_STATUSES = ['active', 'archived', 'closed'] as const

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

/** Backend MessageRole values — do not invent others */
export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const

export type MessageRole = (typeof MESSAGE_ROLES)[number]

/**
 * Matches conversation API responses.
 * `slug` is returned on list/create/update; GET-by-id may omit it.
 * Never send tenantId or userId from the frontend.
 */
export type Conversation = {
  id: string
  tenantId: string
  userId: string | null
  prospectId: string | null
  title: string | null
  slug?: string
  channel: string
  status: string
  summary: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Matches message API responses.
 * `tokenCount` maps from backend total_tokens.
 * Never send tenantId or userId from the frontend.
 */
export type Message = {
  id: string
  tenantId: string
  conversationId: string
  userId: string | null
  role: string
  content: string
  metadata: unknown
  tokenCount: number | null
  createdAt: string
}

/** Matches POST /api/conversations body — never include tenantId or userId */
export type CreateConversationRequest = {
  prospectId?: string
  title?: string
  channel?: ConversationChannel
  summary?: string
}

/**
 * Matches PATCH /api/conversations/:id body — never include tenantId, userId,
 * or prospectId (backend does not support prospect reassignment).
 */
export type UpdateConversationRequest = {
  title?: string
  channel?: ConversationChannel
  status?: ConversationStatus
  summary?: string
}

/** Matches DELETE /api/conversations/:id response */
export type DeleteConversationResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/conversations */
export type ConversationListQuery = {
  search?: string
  channel?: ConversationChannel | string
  status?: ConversationStatus | string
  prospectId?: string
}

/** Matches POST /api/messages body — never include tenantId or userId */
export type CreateMessageRequest = {
  conversationId: string
  role: MessageRole
  content: string
  metadata?: Record<string, unknown>
  tokenCount?: number
}

/**
 * Matches POST /api/conversations/:id/messages body
 * (conversationId comes from the path).
 */
export type CreateNestedMessageRequest = {
  role: MessageRole
  content: string
  metadata?: Record<string, unknown>
  tokenCount?: number
}

/**
 * Matches PATCH /api/messages/:id body.
 * Content and role are immutable after creation.
 */
export type UpdateMessageRequest = {
  metadata?: Record<string, unknown>
  tokenCount?: number
}

/** Matches DELETE /api/messages/:id response */
export type DeleteMessageResponse = {
  message: string
  id: string
}

/** Filters for GET /api/messages — conversationId is required */
export type MessageListQuery = {
  conversationId: string
  role?: MessageRole
}
