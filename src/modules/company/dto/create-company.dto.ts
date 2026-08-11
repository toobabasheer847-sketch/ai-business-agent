import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(500)
  website?: string;
            
  @IsOptional()
  @IsString()
  @MaxLength(255)
  industry?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
