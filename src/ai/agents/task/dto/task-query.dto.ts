import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class TaskQueryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'completed', 'cancelled'] as const)
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'] as const)
  priority?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
