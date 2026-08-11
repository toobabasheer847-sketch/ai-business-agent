import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { ProposalStatus } from './create-proposal.dto';

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;
}
