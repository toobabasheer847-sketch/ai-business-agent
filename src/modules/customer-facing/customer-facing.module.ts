import { Module } from '@nestjs/common';

import { RagModule } from '../../ai/agents/rag/rag.module';
import { AiMonitoringModule } from '../../ai/monitoring/ai-monitoring.module';
import { LeadModule } from '../lead/lead.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { CustomerChatRateLimiter, CustomerChatRateLimitGuard } from './customer-facing.rate-limit';
import { CustomerAiController, PublicCustomerChatController } from './customer-facing.controller';
import { CustomerFacingService } from './customer-facing.service';

@Module({
  imports: [LeadModule, WorkflowModule, RagModule, AiMonitoringModule],
  controllers: [PublicCustomerChatController, CustomerAiController],
  providers: [CustomerFacingService, CustomerChatRateLimiter, CustomerChatRateLimitGuard],
  exports: [CustomerFacingService],
})
export class CustomerFacingModule {}
