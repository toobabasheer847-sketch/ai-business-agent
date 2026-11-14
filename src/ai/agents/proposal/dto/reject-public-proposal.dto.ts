import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPublicProposalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
