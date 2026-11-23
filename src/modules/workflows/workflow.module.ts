import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { TaskModule } from '../../ai/agents/task/task.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { ExceptionModule } from '../exceptions/exception.module';
import { LeadModule } from '../lead/lead.module';
import { WorkflowActionRegistry } from './workflow.actions';
import {
  WorkflowController,
  WorkflowExecutionController,
} from './workflow.controller';
import { WorkflowProcessor } from './workflow.processor';
import { WorkflowScheduler } from './workflow.scheduler';
import { WorkflowService } from './workflow.service';
import { WorkflowTriggerSource } from './workflow.source';
import { DrizzleWorkflowStore } from './workflow.store';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.WORKFLOW_EXECUTION }),
    TaskModule,
    LeadModule,
    ExceptionModule,
  ],
  controllers: [WorkflowController, WorkflowExecutionController],
  providers: [
    DrizzleWorkflowStore,
    WorkflowTriggerSource,
    WorkflowActionRegistry,
    WorkflowService,
    WorkflowProcessor,
    WorkflowScheduler,
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
