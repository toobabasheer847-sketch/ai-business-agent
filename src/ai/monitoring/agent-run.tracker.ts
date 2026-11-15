import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { extractGeminiUsage, type ProviderUsage, unavailableUsage } from './gemini-usage';
import { estimateTokenCost, parseModelPrices } from './model-pricing';
import { getMonitoringContext } from './monitoring-context';
import type { AgentRunRow } from './monitoring.types';
import { sanitizeProviderError } from './sanitize-error';
import { DrizzleAgentRunStore, type AgentRunStore } from './agent-run.store';

export type TrackedCall = {
  tenantId?: string;
  userId?: string | null;
  agentName: string;
  correlationId?: string;
  provider: string;
  model: string;
};

const EMBEDDING_USAGE_NOTE = 'The Gemini embedContent response does not include token counts for this API.';

@Injectable()
export class AgentRunTracker {
  private readonly logger = new Logger(AgentRunTracker.name);

  constructor(
    @Inject(DrizzleAgentRunStore) private readonly store: AgentRunStore,
    private readonly configService: ConfigService,
  ) {}

  async observe<T>(input: TrackedCall, run: () => Promise<T>, usageFrom: (value: T) => ProviderUsage = extractGeminiUsage): Promise<T> {
    const frame = getMonitoringContext();
    const tenantId = input.tenantId || frame?.tenantId;
    if (!tenantId) return run();

    const providerExecutionId = randomUUID();
    const startedAt = new Date();
    const row = this.baseRow({
      ...input,
      tenantId,
      userId: input.userId ?? frame?.userId ?? null,
      correlationId: input.correlationId ?? frame?.correlationId ?? randomUUID(),
      providerExecutionId,
      startedAt,
    });
    const tracked = await this.insertSafely(row);

    try {
      const value = await run();
      if (tracked) {
        await this.finishSafely(input, providerExecutionId, startedAt, usageFrom(value), null);
      }
      return value;
    } catch (error) {
      if (tracked) {
        await this.finishSafely(input, providerExecutionId, startedAt, unavailableUsage('The provider request failed before usage was returned.'), error);
      }
      throw error;
    }
  }

  async recordEmbedding<T>(input: TrackedCall, run: () => Promise<T>): Promise<T> {
    return this.observe(input, run, () => unavailableUsage(EMBEDDING_USAGE_NOTE));
  }

  async recordAdkOutcome(input: TrackedCall & {
    startedAt: Date;
    usages: ProviderUsage[];
    error?: unknown;
  }): Promise<void> {
    const frame = getMonitoringContext();
    const tenantId = input.tenantId || frame?.tenantId;
    if (!tenantId) return;
    const correlationId = input.correlationId ?? frame?.correlationId ?? randomUUID();
    const userId = input.userId ?? frame?.userId ?? null;
    const finishedAt = Date.now();
    if (input.error) {
      await this.insertSafely(this.finishedRow({
        ...input,
        tenantId,
        userId,
        correlationId,
        startedAt: input.startedAt,
        durationMs: finishedAt - input.startedAt.getTime(),
        usage: unavailableUsage('The provider request failed before usage was returned.'),
        error: input.error,
        status: 'failed',
      }));
      return;
    }
    const usages = input.usages.length > 0 ? input.usages : [unavailableUsage('The provider response did not include token counts.')];
    const durationMs = usages.length === 1 ? finishedAt - input.startedAt.getTime() : null;
    for (const usage of usages) {
      await this.insertSafely(this.finishedRow({
        ...input,
        tenantId,
        userId,
        correlationId,
        startedAt: input.startedAt,
        durationMs,
        usage,
        error: null,
        status: 'completed',
      }));
    }
  }

  private async finishSafely(input: TrackedCall, providerExecutionId: string, startedAt: Date, usage: ProviderUsage, error: unknown): Promise<void> {
    const prices = parseModelPrices(this.configService.get<string>('AI_MODEL_PRICING'));
    const cost = estimateTokenCost(usage, prices.find((price) => price.provider === input.provider && price.model === input.model));
    const completedAt = new Date();
    const sanitized = error ? sanitizeProviderError(error) : null;
    try {
      await this.store.complete(providerExecutionId, {
        status: error ? 'failed' : 'completed',
        usageStatus: usage.available ? 'reported' : 'unavailable',
        usageNote: usage.note,
        inputTokens: usage.available ? usage.inputTokens : null,
        outputTokens: usage.available ? usage.outputTokens : null,
        totalTokens: usage.available ? usage.totalTokens : null,
        costStatus: cost.costStatus,
        estimatedInputCost: cost.estimated?.inputCost ?? null,
        estimatedOutputCost: cost.estimated?.outputCost ?? null,
        estimatedTotalCost: cost.estimated?.totalCost ?? null,
        currency: cost.estimated?.currency ?? null,
        pricingSource: cost.estimated?.source ?? null,
        pricingEffectiveDate: cost.estimated?.effectiveDate ?? null,
        durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        completedAt,
        errorCode: sanitized?.code ?? null,
        errorSummary: sanitized?.summary ?? null,
      });
    } catch (storeError) {
      this.logger.warn(`AI run tracking did not finish: ${sanitizeProviderError(storeError).code}`);
    }
  }

  private async insertSafely(row: AgentRunRow): Promise<boolean> {
    try {
      const result = await this.store.insert(row);
      return result === 'inserted';
    } catch (error) {
      this.logger.warn(`AI run tracking did not start: ${sanitizeProviderError(error).code}`);
      return false;
    }
  }

  private baseRow(input: TrackedCall & { tenantId: string; userId: string | null; correlationId: string; providerExecutionId: string; startedAt: Date }): AgentRunRow {
    return {
      id: input.providerExecutionId,
      tenantId: input.tenantId,
      userId: input.userId,
      agentName: input.agentName.slice(0, 80),
      correlationId: input.correlationId,
      parentRunId: null,
      providerExecutionId: input.providerExecutionId,
      provider: input.provider.slice(0, 40),
      model: input.model.slice(0, 120),
      status: 'running',
      usageStatus: 'unavailable',
      usageNote: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costStatus: 'usage_unavailable',
      estimatedInputCost: null,
      estimatedOutputCost: null,
      estimatedTotalCost: null,
      currency: null,
      pricingSource: null,
      pricingEffectiveDate: null,
      durationMs: null,
      startedAt: input.startedAt,
      completedAt: null,
      errorCode: null,
      errorSummary: null,
    };
  }

  private finishedRow(input: TrackedCall & {
    tenantId: string;
    userId: string | null;
    correlationId: string;
    startedAt: Date;
    durationMs: number | null;
    usage: ProviderUsage;
    error: unknown;
    status: 'completed' | 'failed';
  }): AgentRunRow {
    const prices = parseModelPrices(this.configService.get<string>('AI_MODEL_PRICING'));
    const cost = estimateTokenCost(input.usage, prices.find((price) => price.provider === input.provider && price.model === input.model));
    const sanitized = input.error ? sanitizeProviderError(input.error) : null;
    const providerExecutionId = randomUUID();
    return {
      ...this.baseRow({ ...input, providerExecutionId, startedAt: input.startedAt }),
      status: input.status,
      usageStatus: input.usage.available ? 'reported' : 'unavailable',
      usageNote: input.usage.note,
      inputTokens: input.usage.available ? input.usage.inputTokens : null,
      outputTokens: input.usage.available ? input.usage.outputTokens : null,
      totalTokens: input.usage.available ? input.usage.totalTokens : null,
      costStatus: cost.costStatus,
      estimatedInputCost: cost.estimated?.inputCost ?? null,
      estimatedOutputCost: cost.estimated?.outputCost ?? null,
      estimatedTotalCost: cost.estimated?.totalCost ?? null,
      currency: cost.estimated?.currency ?? null,
      pricingSource: cost.estimated?.source ?? null,
      pricingEffectiveDate: cost.estimated?.effectiveDate ?? null,
      durationMs: input.durationMs,
      completedAt: new Date(),
      errorCode: sanitized?.code ?? null,
      errorSummary: sanitized?.summary ?? null,
    };
  }
}
