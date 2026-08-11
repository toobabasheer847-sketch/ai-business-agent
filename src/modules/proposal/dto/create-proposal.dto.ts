import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum ProposalStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class CreateProposalDto {
  /**
   * The prospect this proposal is for. Must belong to the same tenant.
   */
  @IsUUID()
  @IsNotEmpty()
  prospectId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Full proposal content/body (e.g. Markdown or HTML).
   */
  @IsOptional()
  @IsString()
  content?: string;

  /**
   * Initial status. Defaults to 'draft'.
   */
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;
}
