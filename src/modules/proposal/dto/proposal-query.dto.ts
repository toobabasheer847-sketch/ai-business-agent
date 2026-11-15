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

import { ProposalStatus } from './create-proposal.dto';

export class ProposalQueryDto {
  /**
   * Filter by proposal status.
   */
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

  /**
   * Filter by the prospect this proposal was created for.
   */
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  /**
   * Filter by the user who created the proposal.
   */
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  /**
   * Full-text search on title and description.
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
