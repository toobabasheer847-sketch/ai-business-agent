import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateProposalDto {
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(['professional', 'friendly', 'formal', 'concise', 'persuasive'] as const)
  tone?: string;

  @IsOptional()
  @IsEnum(['short', 'medium', 'detailed'] as const)
  length?: string;
}
