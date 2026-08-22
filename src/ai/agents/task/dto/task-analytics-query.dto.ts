import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task.types';

export class TaskAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  prospectId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  assigneeId?: string;
}
