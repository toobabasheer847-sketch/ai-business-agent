import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangeProposalStatusDto {
  @IsEnum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const)
  @IsNotEmpty()
  status: string;

  /** Optional Gmail sender belonging to the authenticated tenant. */
  @IsOptional()
  @IsEmail()
  @IsString()
  fromEmail?: string;
}
