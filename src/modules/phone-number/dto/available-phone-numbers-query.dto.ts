import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AvailablePhoneNumberType {
  LOCAL = 'local',
  TOLL_FREE = 'tollFree',
}

/**
 * Query for Twilio available phone number inventory.
 * Requires locality (city) and/or areaCode to keep search scoped.
 */
export class AvailablePhoneNumbersQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'countryCode must be a 2-letter ISO country code (e.g. US)',
  })
  countryCode?: string = 'US';

  @ValidateIf((o: AvailablePhoneNumbersQueryDto) => !o.areaCode)
  @IsString()
  @IsNotEmpty({ message: 'Provide locality (city) and/or areaCode' })
  @MaxLength(100)
  locality?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(999)
  areaCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  contains?: string;

  @IsOptional()
  @IsEnum(AvailablePhoneNumberType)
  type?: AvailablePhoneNumberType = AvailablePhoneNumberType.LOCAL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
