import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateGmailConfigurationDto {
  /**
   * Gmail address — can be updated if needed.
   */
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  /**
   * Google OAuth2 Client ID.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  /**
   * Google OAuth2 Client Secret. Stored securely and never returned in responses.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientSecret?: string;

  /**
   * OAuth2 Access Token. Stored securely and never returned in responses.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accessToken?: string;

  /**
   * OAuth2 Refresh Token. Stored securely and never returned in responses.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;

  /**
   * ISO-8601 datetime string for when the access token expires.
   */
  @IsOptional()
  @IsString()
  tokenExpiry?: string;

  /**
   * Activate or deactivate this configuration.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
