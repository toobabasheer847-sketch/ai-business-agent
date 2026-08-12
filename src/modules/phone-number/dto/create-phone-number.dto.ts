import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
}
