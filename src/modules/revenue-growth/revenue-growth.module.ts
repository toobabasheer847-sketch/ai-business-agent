import { Module } from '@nestjs/common';

import { TaskModule } from '../../ai/agents/task/task.module';
import { ExceptionModule } from '../exceptions/exception.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { RevenueGrowthController } from './revenue-growth.controller';
import { RevenueGrowthRepository } from './revenue-growth.repository';
import { RevenueGrowthService } from './revenue-growth.service';

@Module({
  imports: [TaskModule, ExceptionModule, WorkflowModule],
  controllers: [RevenueGrowthController],
  providers: [RevenueGrowthRepository, RevenueGrowthService],
  exports: [RevenueGrowthService],
})
export class RevenueGrowthModule {}
