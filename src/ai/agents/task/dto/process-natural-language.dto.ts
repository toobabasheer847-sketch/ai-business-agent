import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ProcessNaturalLanguageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
