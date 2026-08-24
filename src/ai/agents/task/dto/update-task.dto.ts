import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task.types';
import { RECURRENCE_INTERVALS } from '../compute-task-recurrence.js';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  prospectId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsUUID()
  leadId?: string | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsBoolean()
  recurrenceEnabled?: boolean;

  @IsOptional()
  @IsIn(RECURRENCE_INTERVALS)
  recurrenceInterval?: string | null;

  @IsOptional()
  @IsDateString()
  recurrenceEndsAt?: string | null;
}
