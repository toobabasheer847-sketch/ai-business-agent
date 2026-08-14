import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class BuyPhoneNumberDto {
  /**
   * Exact E.164 number selected from the available inventory.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'phoneNumber must be a valid E.164 international phone number (e.g. +14155552671)',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;
}
