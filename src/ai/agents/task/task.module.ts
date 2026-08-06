import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { TaskAgent } from './task.agent.js';
import { TaskRepository } from './task.repository.js';
import { CreateTaskTool } from './tools/create-task.tool.js';
import { UpdateTaskTool } from './tools/update-task.tool.js';
import { GetTaskTool } from './tools/get-task.tool.js';
import { ListTasksTool } from './tools/list-tasks.tool.js';
import { CompleteTaskTool } from './tools/complete-task.tool.js';
import { CancelTaskTool } from './tools/cancel-task.tool.js';
import { AuthGuard } from '../../../common/guards/auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'development-secret'),
        signOptions: { expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN', '86400')) },
      }),
    }),
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskAgent,
    TaskRepository,
    CreateTaskTool,
    UpdateTaskTool,
    GetTaskTool,
    ListTasksTool,
    CompleteTaskTool,
    CancelTaskTool,
    AuthGuard,
  ],
  exports: [TaskService],
})
export class TaskModule {}
