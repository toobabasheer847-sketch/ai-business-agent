import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { LoggingModule } from './logging/logging.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SecurityModule } from './security/security.module.js';

@Module({
  imports: [
    LoggingModule,
    SecurityModule,
    DatabaseModule,
    QueueModule,
    SchedulerModule,
  ],
  exports: [
    LoggingModule,
    SecurityModule,
    DatabaseModule,
    QueueModule,
    SchedulerModule,
  ],
})
export class InfrastructureModule {}
