import { Global, Module } from '@nestjs/common';

import { ApprovalController } from './approval.controller';
import { ApprovalExecutorRegistry } from './approval-executor.registry';
import { ApprovalService } from './approval.service';
import { DrizzleApprovalStore } from './approval.store';

@Global()
@Module({
  controllers: [ApprovalController],
  providers: [DrizzleApprovalStore, ApprovalExecutorRegistry, ApprovalService],
  exports: [ApprovalService, ApprovalExecutorRegistry],
})
export class ApprovalModule {}
