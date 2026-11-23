import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { detectExceptions } from './exception-detect';
import { ExceptionLifecycle, parseExceptionQuery } from './exception-lifecycle';
import { recommend } from './exception-recommendation';
import { ExceptionSource } from './exception.source';
import { DrizzleExceptionStore } from './exception.store';
import type { ExceptionRecord } from './exception.types';

export const EXCEPTION_SCAN_JOB = 'scan-tenant';

@Injectable()
export class ExceptionService {
  private readonly lifecycle: ExceptionLifecycle;
  private readonly running = new Map<string, Promise<unknown>>();

  constructor(
    private readonly records: DrizzleExceptionStore,
    private readonly source: ExceptionSource,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.EXCEPTION_DETECTION) private readonly queue: Queue,
  ) {
    this.lifecycle = new ExceptionLifecycle(records);
  }

  schedulerAvailable() {
    return Boolean(
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('redis.url'),
    );
  }

  async list(tenantId: string, raw: Parameters<typeof parseExceptionQuery>[0]) {
    const page = await this.records.list(tenantId, parseExceptionQuery(raw));
    return { data: page.data.map((row) => present(row)), total: page.total };
  }

  async summary(tenantId: string) {
    const summary = await this.records.summary(tenantId, new Date());
    return {
      ...summary,
      insight:
        summary.open === 0
          ? 'No open exceptions were detected for this tenant.'
          : `Suggestion, not a verified forecast: ${summary.open} open exception${summary.open === 1 ? '' : 's'}, including ${summary.critical} critical and ${summary.high} high.`,
      insightSource: 'rule' as const,
    };
  }

  async attention(tenantId: string) {
    const rows = await this.records.attention(tenantId);
    return rows.map((row) => present(row));
  }

  async detail(tenantId: string, id: string) {
    const row = await this.records.find(tenantId, id);
    if (!row) throw new NotFoundException('Exception not found.');
    const assigneeName = row.assignedTo
      ? await this.records.assigneeName(tenantId, row.assignedTo)
      : null;
    const advice = await recommend(row.recommendedAction);
    return {
      ...present({ ...row, assigneeName }),
      evidence: row.description,
      suggestion: advice.suggestion,
      suggestionSource: advice.suggestionSource,
    };
  }

  async detect(tenantId: string, trigger: 'manual' | 'schedule' = 'manual') {
    const existing = this.running.get(tenantId);
    if (existing) return existing;
    const work = this.scan(tenantId, trigger).finally(() =>
      this.running.delete(tenantId),
    );
    this.running.set(tenantId, work);
    return work;
  }

  async enqueueAll() {
    if (!this.schedulerAvailable()) {
      throw new ServiceUnavailableException(
        'Scheduled exception detection is unavailable because REDIS_URL is not configured.',
      );
    }
    const tenantIds = await this.source.listTenantIds();
    const hour = new Date().toISOString().slice(0, 13);
    let queued = 0;
    let failed = 0;
    for (const tenantId of tenantIds) {
      try {
        await this.queue.add(
          EXCEPTION_SCAN_JOB,
          { tenantId },
          {
            jobId: `exception-scan:${tenantId}:${hour}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
        queued += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/already exists|duplicate job/i.test(message)) {
          queued += 1;
          continue;
        }
        failed += 1;
      }
    }
    if (queued === 0 && failed > 0) {
      throw new ServiceUnavailableException(
        'Exception detection could not be queued.',
      );
    }
    return { queued };
  }

  acknowledge(tenantId: string, userId: string, id: string) {
    return this.lifecycle.acknowledge(tenantId, userId, id).then(present);
  }

  assign(tenantId: string, id: string, userId: string) {
    return this.lifecycle.assign(tenantId, id, userId).then(present);
  }

  changeStatus(
    tenantId: string,
    userId: string,
    id: string,
    status: 'acknowledged' | 'in_progress',
  ) {
    return this.lifecycle
      .changeStatus(tenantId, userId, id, status)
      .then(present);
  }

  resolve(tenantId: string, userId: string, id: string, note?: string) {
    return this.lifecycle.resolve(tenantId, userId, id, note).then(present);
  }

  dismiss(tenantId: string, userId: string, id: string, reason: string) {
    return this.lifecycle.dismiss(tenantId, userId, id, reason).then(present);
  }

  async recordDrafts(tenantId: string, drafts: Parameters<ExceptionLifecycle['apply']>[1]) {
    return this.lifecycle.apply(tenantId, drafts, false);
  }

  private async scan(tenantId: string, trigger: 'manual' | 'schedule') {
    const startedAt = new Date();
    try {
      const snapshot = await this.source.load(tenantId, startedAt);
      const drafts = detectExceptions(snapshot);
      const counts = await this.lifecycle.apply(
        tenantId,
        drafts,
        !snapshot.truncated,
      );
      await this.records.recordScan({
        tenantId,
        trigger,
        status: 'completed',
        startedAt,
        finishedAt: new Date(),
        createdCount: counts.created,
        updatedCount: counts.updated,
        resolvedCount: counts.resolved,
        errorSummary: null,
      });
      return {
        ...counts,
        truncated: snapshot.truncated,
        schedulerAvailable: this.schedulerAvailable(),
        sendsMessages: false as const,
      };
    } catch (error) {
      const summary =
        error instanceof Error
          ? error.message.slice(0, 300)
          : 'Detection failed.';
      try {
        await this.records.recordScan({
          tenantId,
          trigger,
          status: 'failed',
          startedAt,
          finishedAt: new Date(),
          createdCount: 0,
          updatedCount: 0,
          resolvedCount: 0,
          errorSummary: summary,
        });
      } catch {
        // The original detection error is more useful than a second write failure.
      }
      throw error;
    }
  }
}

function present(row: ExceptionRecord & { assigneeName?: string | null }) {
  return {
    ...row,
    assigneeName: row.assigneeName ?? null,
    detectedAt: row.detectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
