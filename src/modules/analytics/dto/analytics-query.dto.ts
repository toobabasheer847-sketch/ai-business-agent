import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'custom'])
  range?: '7d' | '30d' | '90d' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;
}
