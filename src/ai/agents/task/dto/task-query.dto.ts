import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task.types';

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
}
