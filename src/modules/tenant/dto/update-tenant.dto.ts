import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTenantDto {
  /**
   * Display name for the authenticated tenant organization.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name?: string;
}
