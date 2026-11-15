import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AgentRunTracker } from './agent-run.tracker';
import type { AgentRunStore } from './agent-run.store';
import { extractGeminiUsage } from './gemini-usage';
import { estimateTokenCost, findModelPrice, parseModelPrices } from './model-pricing';
import { canReadMonitoring, monitoringScope, parseMonitoringQuery, runMatchesScope } from './monitoring-query';
import type { AgentRunRow } from './monitoring.types';
import { sanitizeProviderError } from './sanitize-error';

const priceList = JSON.stringify([
  {
    provider: 'example',
    model: 'example-small',
    inputPerMillion: '1.50',
    outputPerMillion: '2.50',
    currency: 'USD',
    source: 'Test fixture, not a provider invoice',
    effectiveDate: '2026-01-01',
  },
  {
    provider: 'example',
    model: 'example-large',
    inputPerMillion: '3.00',
    outputPerMillion: '6.00',
    currency: 'USD',
    source: 'Test fixture, not a provider invoice',
    effectiveDate: '2026-01-01',
  },
]);

class MemoryStore implements AgentRunStore {
  rows: AgentRunRow[] = [];

  async insert(row: AgentRunRow): Promise<'inserted' | 'duplicate'> {
    if (this.rows.some((existing) => existing.providerExecutionId === row.providerExecutionId)) return 'duplicate';
    this.rows.push({ ...row });
    return 'inserted';
  }

  async complete(providerExecutionId: string, patch: Partial<AgentRunRow>): Promise<void> {
    const row = this.rows.find((existing) => existing.providerExecutionId === providerExecutionId);
    if (row) Object.assign(row, patch);
  }
}

function tracker(store: MemoryStore, pricing = '') {
  return new AgentRunTracker(store as never, { get: () => pricing } as unknown as ConfigService);
}

const reported = {
  usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 2_000_000, totalTokenCount: 3_000_000 },
};

describe('AI monitoring', () => {
  it('records a successful provider call with reported usage and estimated cost', async () => {
    const store = new MemoryStore();
    const result = await tracker(store, priceList).observe(
      { tenantId: 'tenant-a', userId: 'user-a', agentName: 'orchestrator', provider: 'example', model: 'example-small' },
      async () => reported,
    );

    expect(result).toBe(reported);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({
      status: 'completed',
      usageStatus: 'reported',
      inputTokens: 1_000_000,
      outputTokens: 2_000_000,
      totalTokens: 3_000_000,
      costStatus: 'estimated',
      estimatedInputCost: '1.50000000',
      estimatedOutputCost: '5.00000000',
      estimatedTotalCost: '6.50000000',
      currency: 'USD',
    });
  });

  it('records a failed provider call and still throws the provider error', async () => {
    const store = new MemoryStore();
    await expect(tracker(store).observe(
      { tenantId: 'tenant-a', userId: 'user-a', agentName: 'proposal', provider: 'example', model: 'example-small' },
      async () => { throw new Error('model overloaded'); },
    )).rejects.toThrow('model overloaded');

    expect(store.rows[0].status).toBe('failed');
    expect(store.rows[0].errorSummary).toBe('model overloaded');
    expect(store.rows[0].inputTokens).toBeNull();
  });

  it('keeps the run when token usage is missing and does not invent counts', async () => {
    const store = new MemoryStore();
    await tracker(store, priceList).observe(
      { tenantId: 'tenant-a', userId: 'user-a', agentName: 'knowledge-agent', provider: 'example', model: 'example-small' },
      async () => ({ text: 'answer' }),
    );

    expect(store.rows[0]).toMatchObject({
      status: 'completed',
      usageStatus: 'unavailable',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costStatus: 'usage_unavailable',
      estimatedTotalCost: null,
    });
  });

  it('stores usage and marks cost unavailable when pricing is not configured', async () => {
    const store = new MemoryStore();
    await tracker(store, '').observe(
      { tenantId: 'tenant-a', userId: 'user-a', agentName: 'orchestrator', provider: 'example', model: 'example-small' },
      async () => reported,
    );

    expect(store.rows[0].usageStatus).toBe('reported');
    expect(store.rows[0].inputTokens).toBe(1_000_000);
    expect(store.rows[0].costStatus).toBe('pricing_not_configured');
    expect(store.rows[0].estimatedTotalCost).toBeNull();
  });

  it('prices only the configured model', () => {
    const prices = parseModelPrices(priceList);
    const usage = extractGeminiUsage(reported);
    expect(estimateTokenCost(usage, findModelPrice(prices, 'example', 'example-large')).estimated?.totalCost).toBe('15.00000000');
    expect(estimateTokenCost(usage, findModelPrice(prices, 'example', 'example-small')).estimated?.totalCost).toBe('6.50000000');
    expect(estimateTokenCost(usage, findModelPrice(prices, 'example', 'missing')).costStatus).toBe('pricing_not_configured');
  });

  it('does not insert a second row for the same provider execution', async () => {
    const store = new MemoryStore();
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'tenant-a',
      userId: 'user-a',
      agentName: 'orchestrator',
      correlationId: '22222222-2222-4222-8222-222222222222',
      parentRunId: null,
      providerExecutionId: '11111111-1111-4111-8111-111111111111',
      provider: 'example',
      model: 'example-small',
      status: 'completed' as const,
      usageStatus: 'unavailable' as const,
      usageNote: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costStatus: 'usage_unavailable' as const,
      estimatedInputCost: null,
      estimatedOutputCost: null,
      estimatedTotalCost: null,
      currency: null,
      pricingSource: null,
      pricingEffectiveDate: null,
      durationMs: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      errorCode: null,
      errorSummary: null,
    };
    await store.insert(row);
    await expect(store.insert(row)).resolves.toBe('duplicate');
    expect(store.rows).toHaveLength(1);
  });

  it('limits members to their own runs and owners to the tenant', () => {
    expect(canReadMonitoring('member')).toBe(true);
    expect(canReadMonitoring('admin')).toBe(true);
    expect(canReadMonitoring('owner')).toBe(true);
    expect(monitoringScope({ tenantId: 'tenant-a', userId: 'member-1', role: 'member' })).toEqual({
      tenantId: 'tenant-a',
      userId: 'member-1',
    });
    expect(monitoringScope({ tenantId: 'tenant-a', userId: 'owner-1', role: 'owner' })).toEqual({ tenantId: 'tenant-a' });
    expect(monitoringScope({ tenantId: 'tenant-a', userId: 'admin-1', role: 'admin' })).toEqual({ tenantId: 'tenant-a' });
    expect(runMatchesScope({ tenantId: 'tenant-b', userId: 'member-1' }, { tenantId: 'tenant-a', userId: 'member-1' })).toBe(false);
    expect(runMatchesScope({ tenantId: 'tenant-a', userId: 'other' }, { tenantId: 'tenant-a', userId: 'member-1' })).toBe(false);
    expect(runMatchesScope({ tenantId: 'tenant-a', userId: 'other' }, { tenantId: 'tenant-a' })).toBe(true);
  });

  it('paginates and rejects unsupported filters', () => {
    expect(parseMonitoringQuery({ page: '2', limit: '10', agent: 'proposal', provider: 'google', model: 'example-small', status: 'failed' })).toMatchObject({
      page: 2,
      limit: 10,
      offset: 10,
      agent: 'proposal',
      provider: 'google',
      model: 'example-small',
      status: 'failed',
    });
    expect(() => parseMonitoringQuery({ sort: 'cost' })).toThrow(BadRequestException);
    expect(() => parseMonitoringQuery({ page: '0' })).toThrow(BadRequestException);
    expect(() => parseMonitoringQuery({ from: 'not-a-date' })).toThrow(BadRequestException);
  });

  it('returns the provider result when tracking storage fails', async () => {
    const store: AgentRunStore = {
      insert: async () => { throw new Error('database unavailable'); },
      complete: async () => undefined,
    };
    const result = await new AgentRunTracker(store as never, { get: () => '' } as unknown as ConfigService).observe(
      { tenantId: 'tenant-a', userId: 'user-a', agentName: 'orchestrator', provider: 'example', model: 'example-small' },
      async () => 'answer',
    );
    expect(result).toBe('answer');
  });

  it('summarizes reported tokens separately from runs without usage', () => {
    const rows = [
      { status: 'completed', usageStatus: 'reported', inputTokens: 10, outputTokens: 4, costStatus: 'estimated', estimatedTotalCost: '0.10000000', durationMs: 100 },
      { status: 'failed', usageStatus: 'unavailable', inputTokens: null, outputTokens: null, costStatus: 'usage_unavailable', estimatedTotalCost: null, durationMs: 300 },
      { status: 'completed', usageStatus: 'reported', inputTokens: 5, outputTokens: 1, costStatus: 'pricing_not_configured', estimatedTotalCost: null, durationMs: null },
    ];
    const reportedRows = rows.filter((row) => row.usageStatus === 'reported');
    const summary = {
      totalRuns: rows.length,
      successfulRuns: rows.filter((row) => row.status === 'completed').length,
      failedRuns: rows.filter((row) => row.status === 'failed').length,
      inputTokens: reportedRows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
      outputTokens: reportedRows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
      usageUnavailableRuns: rows.filter((row) => row.usageStatus === 'unavailable').length,
      pricingNotConfiguredRuns: rows.filter((row) => row.costStatus === 'pricing_not_configured').length,
      estimatedCost: '0.10000000',
      averageDurationMs: 200,
    };
    expect(summary).toEqual({
      totalRuns: 3,
      successfulRuns: 2,
      failedRuns: 1,
      inputTokens: 15,
      outputTokens: 5,
      usageUnavailableRuns: 1,
      pricingNotConfiguredRuns: 1,
      estimatedCost: '0.10000000',
      averageDurationMs: 200,
    });
  });

  it('redacts secrets from stored error summaries', () => {
    const sanitized = sanitizeProviderError(new Error('key AIzaSyEXAMPLEKEY1234567890 and ada@example.com'));
    expect(sanitized.summary).not.toContain('AIza');
    expect(sanitized.summary).not.toContain('ada@example.com');
  });

  it('records one unavailable ADK run when the provider omits usage', async () => {
    const store = new MemoryStore();
    await tracker(store).recordAdkOutcome({
      tenantId: 'tenant-a',
      userId: 'user-a',
      agentName: 'master-agent',
      provider: 'example',
      model: 'example-small',
      startedAt: new Date(Date.now() - 25),
      usages: [],
    });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].usageStatus).toBe('unavailable');
    expect(store.rows[0].durationMs).not.toBeNull();
  });
});
