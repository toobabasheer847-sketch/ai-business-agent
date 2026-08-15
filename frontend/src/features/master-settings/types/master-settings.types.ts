/** Matches GET/PATCH /api/master-settings response */
export type MasterSettings = {
  id: string
  tenantId: string
  defaultLanguage: string
  defaultTimezone: string
  defaultCurrency: string
  aiModel: string | null
  maxConversationHistory: number
  enableNotifications: boolean
  notificationEmail: string | null
  businessHoursStart: number
  businessHoursEnd: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Matches PATCH /api/master-settings body.
 * Never include tenantId — tenant comes from JWT.
 */
export type UpdateMasterSettingsRequest = {
  defaultLanguage?: string
  defaultTimezone?: string
  defaultCurrency?: string
  aiModel?: string | null
  maxConversationHistory?: number
  enableNotifications?: boolean
  notificationEmail?: string | null
  businessHoursStart?: number
  businessHoursEnd?: number
  isActive?: boolean
}
