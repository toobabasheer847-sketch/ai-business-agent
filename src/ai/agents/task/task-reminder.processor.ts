import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.module.js';
import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import {
  TASK_REMINDER_JOB_NAME,
  type TaskReminderJobPayload,
} from './task-reminder.constants.js';
import { TaskReminderService } from './task-reminder.service.js';

@Processor(QUEUE_NAMES.TASK_REMINDER)
export class TaskReminderProcessor extends WorkerHost {
  constructor(
    private readonly reminderService: TaskReminderService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<TaskReminderJobPayload>): Promise<void> {
    if (job.name !== TASK_REMINDER_JOB_NAME) {
      return;
    }

    try {
      await this.reminderService.processReminder(job.data);
    } catch (error) {
      this.logger.error(
        'Task reminder worker failed',
        error instanceof Error ? error.stack : undefined,
        {
          tenantId: job.data?.tenantId,
          userId: job.data?.userId,
          requestId: `task-reminder-job:${job.id}`,
        },
        { jobId: job.id, taskId: job.data?.taskId },
      );
      throw error;
    }
  }
}
