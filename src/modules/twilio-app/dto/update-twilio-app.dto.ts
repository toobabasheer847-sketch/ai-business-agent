import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TwilioAppStatus } from './create-twilio-app.dto';

export class UpdateTwilioAppDto {
  /**
   * Reassign to a different phone number (must belong to the same tenant).
   */
  @IsOptional()
  @IsUUID()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountSid?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appSid?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @IsOptional()
  @IsEnum(TwilioAppStatus)
  status?: TwilioAppStatus;
}
