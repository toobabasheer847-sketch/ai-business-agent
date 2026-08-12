import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { TwilioAppStatus } from './create-twilio-app.dto';

export class TwilioAppQueryDto {
  /**
   * Filter by linked phone number.
   */
  @IsOptional()
  @IsUUID()
  phoneNumberId?: string;

  /**
   * Filter by status.
   */
  @IsOptional()
  @IsEnum(TwilioAppStatus)
  status?: TwilioAppStatus;

  /**
   * Search on accountSid, appSid, or webhookUrl.
   */
  @IsOptional()
  @IsString()
  search?: string;
}
