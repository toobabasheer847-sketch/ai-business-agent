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

import { PhoneNumberProvider, PhoneNumberStatus } from './create-phone-number.dto';

export class UpdatePhoneNumberDto {
  /**
   * Updated phone number in E.164 format.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber must be a valid E.164 international phone number (e.g. +923001234567)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsEnum(PhoneNumberProvider)
  provider?: PhoneNumberProvider;

  @IsOptional()
  @IsEnum(PhoneNumberStatus)
  status?: PhoneNumberStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneSid?: string;

  /** Twilio Account SID. Empty string clears the stored value. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  twilioSid?: string;

  /**
   * Twilio Auth Token. Omit or send empty to keep the current token.
   * Send a new value to replace it. Use disconnect-twilio to clear it.
   */
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
