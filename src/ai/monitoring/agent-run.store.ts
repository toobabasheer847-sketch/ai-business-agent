import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import type { AgentRunRow } from './monitoring.types';

export interface AgentRunStore {
  insert(row: AgentRunRow): Promise<'inserted' | 'duplicate'>;
  complete(providerExecutionId: string, patch: Partial<AgentRunRow>): Promise<void>;
}

@Injectable()
export class DrizzleAgentRunStore implements AgentRunStore {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async insert(row: AgentRunRow): Promise<'inserted' | 'duplicate'> {
    const inserted = await this.db
      .insert(agentRuns)
      .values({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        agentName: row.agentName,
        correlationId: row.correlationId,
        parentRunId: row.parentRunId,
        providerExecutionId: row.providerExecutionId,
        provider: row.provider,
        model: row.model,
        status: row.status,
        usageStatus: row.usageStatus,
        usageNote: row.usageNote,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        costStatus: row.costStatus,
        estimatedInputCost: row.estimatedInputCost,
        estimatedOutputCost: row.estimatedOutputCost,
        estimatedTotalCost: row.estimatedTotalCost,
        currency: row.currency,
        pricingSource: row.pricingSource,
        pricingEffectiveDate: row.pricingEffectiveDate,
        durationMs: row.durationMs,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        errorCode: row.errorCode,
        errorSummary: row.errorSummary,
      })
      .onConflictDoNothing({ target: agentRuns.providerExecutionId })
      .returning({ id: agentRuns.id });
    return inserted.length > 0 ? 'inserted' : 'duplicate';
  }

  async complete(providerExecutionId: string, patch: Partial<AgentRunRow>): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: patch.status,
        usageStatus: patch.usageStatus,
        usageNote: patch.usageNote,
        inputTokens: patch.inputTokens,
        outputTokens: patch.outputTokens,
        totalTokens: patch.totalTokens,
        costStatus: patch.costStatus,
        estimatedInputCost: patch.estimatedInputCost,
        estimatedOutputCost: patch.estimatedOutputCost,
        estimatedTotalCost: patch.estimatedTotalCost,
        currency: patch.currency,
        pricingSource: patch.pricingSource,
        pricingEffectiveDate: patch.pricingEffectiveDate,
        durationMs: patch.durationMs,
        completedAt: patch.completedAt,
        errorCode: patch.errorCode,
        errorSummary: patch.errorSummary,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.providerExecutionId, providerExecutionId));
  }
}
