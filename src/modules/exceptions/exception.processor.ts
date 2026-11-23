import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { EXCEPTION_SCAN_JOB, ExceptionService } from './exception.service';

type ScanJob = { tenantId: string };

@Processor(QUEUE_NAMES.EXCEPTION_DETECTION)
export class ExceptionProcessor extends WorkerHost {
  constructor(private readonly exceptions: ExceptionService) {
    super();
  }

  async process(job: Job<ScanJob>): Promise<void> {
    if (job.name !== EXCEPTION_SCAN_JOB || !job.data?.tenantId) return;
    await this.exceptions.detect(job.data.tenantId, 'schedule');
  }
}
