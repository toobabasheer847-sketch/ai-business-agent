import { IsIn, IsOptional } from 'class-validator';

import { TaskAnalyticsQueryDto } from './task-analytics-query.dto';

export const TASK_ANALYTICS_GROUP_BY = ['day', 'week', 'month'] as const;

export class TaskAnalyticsTrendsQueryDto extends TaskAnalyticsQueryDto {
  @IsOptional()
  @IsIn(TASK_ANALYTICS_GROUP_BY)
  groupBy?: 'day' | 'week' | 'month';
}
