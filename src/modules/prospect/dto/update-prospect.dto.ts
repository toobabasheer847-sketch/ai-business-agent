import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ProspectStatus } from './create-prospect.dto';

export class UpdateProspectDto {
  /**
   * Reassign prospect to a different company (must belong to the same tenant).
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  /**
   * Reassign prospect to a different lead (must belong to the same tenant).
   */
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  @IsOptional()
  @IsEnum(ProspectStatus)
  status?: ProspectStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
