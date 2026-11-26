import { Module } from '@nestjs/common';

import { TaskModule } from '../../ai/agents/task/task.module';
import { ExceptionModule } from '../exceptions/exception.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { CustomerRetentionController } from './customer-retention.controller';
import { CustomerRetentionRepository } from './customer-retention.repository';
import { CustomerRetentionService } from './customer-retention.service';

@Module({
  imports: [TaskModule, ExceptionModule, WorkflowModule],
  controllers: [CustomerRetentionController],
  providers: [CustomerRetentionRepository, CustomerRetentionService],
  exports: [CustomerRetentionService],
})
export class CustomerRetentionModule {}
