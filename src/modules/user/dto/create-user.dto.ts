import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  /**
   * Plaintext password — hashed before storage. Never returned in API responses.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  /**
   * Whether the user account is active. Defaults to true.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
