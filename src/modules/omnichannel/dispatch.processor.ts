import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { DISPATCH_JOB, OmnichannelService } from './omnichannel.service';

@Processor(QUEUE_NAMES.COMMUNICATION_DISPATCH)
export class DispatchProcessor extends WorkerHost {
  constructor(private readonly omnichannel: OmnichannelService) {
    super();
  }

  async process(job: Job<{ tenantId: string; dispatchId: string }>): Promise<void> {
    if (job.name !== DISPATCH_JOB || !job.data?.tenantId || !job.data.dispatchId) return;
    const result = await this.omnichannel.perform(job.data.tenantId, job.data.dispatchId);
    if (result.retry) throw new Error('communication_dispatch_retry');
  }
}
