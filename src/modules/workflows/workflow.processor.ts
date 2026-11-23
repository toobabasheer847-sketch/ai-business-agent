import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { WORKFLOW_SCAN_JOB, WorkflowService } from './workflow.service';

@Processor(QUEUE_NAMES.WORKFLOW_EXECUTION)
export class WorkflowProcessor extends WorkerHost {
  constructor(private readonly workflows: WorkflowService) {
    super();
  }

  async process(job: Job<{ tenantId: string }>): Promise<void> {
    if (job.name !== WORKFLOW_SCAN_JOB || !job.data?.tenantId) return;
    await this.workflows.scanTenant(job.data.tenantId);
  }
}
