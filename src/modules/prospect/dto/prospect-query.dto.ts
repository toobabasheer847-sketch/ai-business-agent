import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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
}
