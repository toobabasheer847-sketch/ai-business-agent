import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum ProspectStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  UNQUALIFIED = 'unqualified',
  CONVERTED = 'converted',
  LOST = 'lost',
}

export class CreateProspectDto {
  /**
   * The company this prospect belongs to. Must belong to the same tenant.
   */
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  /**
   * The lead this prospect was converted/associated from. Must belong to the same tenant.
   */
  @IsUUID()
  @IsNotEmpty()
  leadId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  /**
   * Prospect lifecycle status. Defaults to 'new'.
   */
  @IsOptional()
  @IsEnum(ProspectStatus)
  status?: ProspectStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
