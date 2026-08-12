import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
}
