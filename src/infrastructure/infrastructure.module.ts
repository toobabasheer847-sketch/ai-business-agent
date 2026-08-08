import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { LoggingModule } from './logging/logging.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    LoggingModule,
    DatabaseModule,
    QueueModule,
    SchedulerModule,
  ],
  exports: [
    LoggingModule,
    DatabaseModule,
    QueueModule,
    SchedulerModule,
  ],
})
export class InfrastructureModule {}