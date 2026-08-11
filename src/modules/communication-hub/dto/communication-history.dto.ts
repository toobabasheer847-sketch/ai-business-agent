import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CommunicationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  CALL = 'call',
  WEB = 'web',
  ALL = 'all',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  ALL = 'all',
}

export class GetCommunicationHistoryDto {
  @IsOptional()
  @IsEnum(CommunicationChannel)
  channel?: CommunicationChannel;

  @IsOptional()
  @IsEnum(CommunicationDirection)
  direction?: CommunicationDirection;

  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GetThreadDetailDto {
  @IsUUID()
  id: string;
}
