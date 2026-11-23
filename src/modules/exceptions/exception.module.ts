import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { ExceptionController } from './exception.controller';
import { ExceptionProcessor } from './exception.processor';
import { ExceptionScheduler } from './exception.scheduler';
import { ExceptionService } from './exception.service';
import { ExceptionSource } from './exception.source';
import { DrizzleExceptionStore } from './exception.store';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.EXCEPTION_DETECTION }),
  ],
  controllers: [ExceptionController],
  providers: [
    DrizzleExceptionStore,
    ExceptionSource,
    ExceptionService,
    ExceptionProcessor,
    ExceptionScheduler,
  ],
  exports: [ExceptionService],
})
export class ExceptionModule {}
