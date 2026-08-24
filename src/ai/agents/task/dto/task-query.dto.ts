import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task.types';
import { TASK_REMINDER_API_STATUSES } from '../task-reminder.constants';

export class TaskQueryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  openOnly?: boolean;

  @IsOptional()
  @IsIn([...TASK_REMINDER_API_STATUSES, 'pending'])
  reminderStatus?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  hasReminder?: boolean;

  @IsOptional()
  @IsDateString()
  reminderFrom?: string;

  @IsOptional()
  @IsDateString()
  reminderTo?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  blocked?: boolean;
}
