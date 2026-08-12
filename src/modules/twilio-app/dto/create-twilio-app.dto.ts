import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum TwilioAppStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ERROR = 'error',
}

export class CreateTwilioAppDto {
  /**
   * Phone number this Twilio App is linked to. Must belong to the same tenant.
   */
  @IsUUID()
  @IsNotEmpty()
  phoneNumberId!: string;

  /**
   * Twilio Account SID (e.g. ACxxxxxxxx...).
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountSid!: string;

  /**
   * Twilio Auth Token for this account.
   */
  @IsString()
  @IsNotEmpty()
  authToken!: string;

  /**
   * Optional Twilio Application SID (e.g. APxxxxxxxx...).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  appSid?: string;

  /**
   * Optional webhook URL for Twilio callbacks.
   */
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  /**
   * Initial status. Defaults to 'active'.
   */
  @IsOptional()
  @IsEnum(TwilioAppStatus)
  status?: TwilioAppStatus;
}
