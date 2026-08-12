import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UserQueryDto {
  /**
   * Filter by active status. Accepts true/false query strings.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  /**
   * Search on name and email.
   */
  @IsOptional()
  @IsString()
  search?: string;
}
