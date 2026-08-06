import { IsEnum, IsNotEmpty } from 'class-validator';

export class ChangeProposalStatusDto {
  @IsEnum(['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'] as const)
  @IsNotEmpty()
  status: string;
}
