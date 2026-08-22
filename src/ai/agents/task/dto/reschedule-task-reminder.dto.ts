import { IsDateString } from 'class-validator';

export class RescheduleTaskReminderDto {
  @IsDateString()
  scheduledAt: string;
}
