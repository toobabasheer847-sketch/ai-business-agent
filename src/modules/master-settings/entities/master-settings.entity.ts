export interface MasterSettings {
  id: string;
  tenantId: string;
  defaultLanguage: string;
  defaultTimezone: string;
  defaultCurrency: string;
  aiModel: string | null;
  maxConversationHistory: number;
  enableNotifications: boolean;
  notificationEmail: string | null;
  businessHoursStart: number;
  businessHoursEnd: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
