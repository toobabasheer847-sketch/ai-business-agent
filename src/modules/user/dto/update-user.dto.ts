import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  /**
   * Optional new plaintext password — hashed before storage.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
