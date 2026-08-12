import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMasterSettingsDto {
  /**
   * Language/locale code (e.g. 'en', 'en-US', 'fr').
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  defaultLanguage?: string;

  /**
   * IANA timezone string (e.g. 'America/New_York', 'Europe/London', 'UTC').
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  defaultTimezone?: string;

  /**
   * ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP').
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  defaultCurrency?: string;

  /**
   * AI model override (e.g. 'gemini-2.0-flash', 'gemini-1.5-pro').
   * Set to null to revert to the system default.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  aiModel?: string | null;

  /**
   * Maximum number of conversation history turns sent to the AI context.
   * Range: 1–100.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConversationHistory?: number;

  /**
   * Whether email notifications are enabled for this tenant.
   */
  @IsOptional()
  @IsBoolean()
  enableNotifications?: boolean;

  /**
   * Email address for tenant-level notifications.
   * Set to null to clear.
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  notificationEmail?: string | null;

  /**
   * Business hours start hour in 24h format (0–23).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessHoursStart?: number;

  /**
   * Business hours end hour in 24h format (0–23).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessHoursEnd?: number;

  /**
   * Activate or deactivate the tenant's settings.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
