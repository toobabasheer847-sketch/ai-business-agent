import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import { PhoneNumberProvider, PhoneNumberStatus } from './create-phone-number.dto';

export class PhoneNumberQueryDto {
  /**
   * Filter by provider.
   */
  @IsOptional()
  @IsEnum(PhoneNumberProvider)
  provider?: PhoneNumberProvider;

  /**
   * Filter by status.
   */
  @IsOptional()
  @IsEnum(PhoneNumberStatus)
  status?: PhoneNumberStatus;

  /**
   * Search by label, phoneNumber, or description (case-insensitive).
   */
  @IsOptional()
  @IsString()
  search?: string;
}
