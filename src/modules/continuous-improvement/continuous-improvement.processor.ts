import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { IMPROVEMENT_MONITOR_JOB, ContinuousImprovementService } from './continuous-improvement.service';

type MonitorJob = { tenantId?: string };

@Processor(QUEUE_NAMES.CONTINUOUS_IMPROVEMENT)
export class ContinuousImprovementProcessor extends WorkerHost {
  constructor(private readonly improvement: ContinuousImprovementService) {
    super();
  }

  async process(job: Job<MonitorJob>): Promise<void> {
    if (job.name !== IMPROVEMENT_MONITOR_JOB || !job.data?.tenantId) return;
    await this.improvement.monitor(job.data.tenantId);
  }
}
