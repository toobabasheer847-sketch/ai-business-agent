import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../../../modules/auth/auth.module.js';
import { CompanyModule } from '../../../modules/company/company.module';
import { LeadModule } from '../../../modules/lead/lead.module';
import { ProspectModule } from '../../../modules/prospect/prospect.module';
import { UserModule } from '../../../modules/user/user.module';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { TaskAgent } from './task.agent.js';
import { TaskRepository } from './task.repository.js';
import { TaskCrmResolver } from './resolve-crm-entities.js';
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
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskAgent,
    TaskRepository,
    TaskCrmResolver,
    CreateTaskTool,
    UpdateTaskTool,
    GetTaskTool,
    ListTasksTool,
    CompleteTaskTool,
    CancelTaskTool,
  ],
  exports: [TaskService, TaskAgent],
})
export class TaskModule {}
