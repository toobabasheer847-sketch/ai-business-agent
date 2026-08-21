import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
