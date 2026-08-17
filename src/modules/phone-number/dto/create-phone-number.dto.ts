import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum PhoneNumberProvider {
  TWILIO = 'twilio',
  VONAGE = 'vonage',
  CUSTOM = 'custom',
}

export enum PhoneNumberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export class CreatePhoneNumberDto {
  /**
   * Phone number in E.164 international format.
   * Example: +923001234567
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber must be a valid E.164 international phone number (e.g. +923001234567)',
  })
  phoneNumber!: string;

  /**
   * Human-readable label for this phone number (e.g. 'Support Line', 'Sales').
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  /**
   * Communication provider. Defaults to 'twilio'.
   */
  @IsOptional()
  @IsEnum(PhoneNumberProvider)
  provider?: PhoneNumberProvider;

  /**
   * Initial status. Defaults to 'active'.
   */
  @IsOptional()
  @IsEnum(PhoneNumberStatus)
  status?: PhoneNumberStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneSid?: string;

  /** Twilio Account SID */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  twilioSid?: string;

  /** Twilio Auth Token — stored, never returned in API responses. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  authToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appSid?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;
}
