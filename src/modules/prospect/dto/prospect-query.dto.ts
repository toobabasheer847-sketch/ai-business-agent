import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { ProspectStatus } from './create-prospect.dto';

export class ProspectQueryDto {
  /**
   * Filter by prospect status.
   */
  @IsOptional()
  @IsEnum(ProspectStatus)
  status?: ProspectStatus;

  /**
   * Filter by company.
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  /**
   * Filter by associated lead.
   */
  @IsOptional()
  @IsUUID()
  leadId?: string;

  /**
   * Search on firstName, lastName, and email.
   */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
