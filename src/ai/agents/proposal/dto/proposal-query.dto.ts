import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProposalQueryDto {
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @IsOptional()
  @IsEnum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const)
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
