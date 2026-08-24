import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../../../modules/auth/auth.module.js';
import { CompanyModule } from '../../../modules/company/company.module';
import { LeadModule } from '../../../modules/lead/lead.module';
import { ProspectModule } from '../../../modules/prospect/prospect.module';
import { UserModule } from '../../../modules/user/user.module';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.module.js';
import { GmailModule } from '../communication/gmail/gmail.module.js';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { TaskAgent } from './task.agent.js';
import { TaskRepository } from './task.repository.js';
import { TaskCrmResolver } from './resolve-crm-entities.js';
import { TaskActivityRepository } from './task-activity.repository.js';
import { TaskAnalyticsRepository } from './task-analytics.repository.js';
import { TaskReminderProcessor } from './task-reminder.processor.js';
import { TaskReminderRepository } from './task-reminder.repository.js';
import { TaskReminderService } from './task-reminder.service.js';
import { TaskDependencyRepository } from './task-dependency.repository.js';
import { CreateTaskTool } from './tools/create-task.tool.js';
import { UpdateTaskTool } from './tools/update-task.tool.js';
import { GetTaskTool } from './tools/get-task.tool.js';
import { ListTasksTool } from './tools/list-tasks.tool.js';
import { CompleteTaskTool } from './tools/complete-task.tool.js';
import { CancelTaskTool } from './tools/cancel-task.tool.js';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UserModule,
    CompanyModule,
    ProspectModule,
    LeadModule,
    GmailModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.TASK_REMINDER }),
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskAgent,
    TaskRepository,
    TaskCrmResolver,
    TaskActivityRepository,
    TaskAnalyticsRepository,
    TaskReminderRepository,
    TaskReminderService,
    TaskReminderProcessor,
    TaskDependencyRepository,
    CreateTaskTool,
    UpdateTaskTool,
    GetTaskTool,
    ListTasksTool,
    CompleteTaskTool,
    CancelTaskTool,
  ],
  exports: [TaskService, TaskAgent, TaskReminderService],
})
export class TaskModule {}
