import {
  addStatus,
  buildRecommendations,
  DEFAULT_BASELINE_SECONDS,
  emptyCounts,
  estimateSavings,
  executionRates,
  parseBaselines,
  summarizeDurations,
  summarizeWorkflowAi,
  workflowHealth,
} from './workflow-analytics';

function counts(
  completed: number,
  failed: number,
  partial = 0,
  cancelled = 0,
  running = 0,
) {
  const result = emptyCounts();
  addStatus(result, 'completed', completed);
  addStatus(result, 'failed', failed);
  addStatus(result, 'partially_completed', partial);
  addStatus(result, 'cancelled', cancelled);
  addStatus(result, 'running', running);
  addStatus(result, 'waiting_for_approval', 0);
  return result;
}

describe('workflow analytics formulas', () => {
  it('calculates success and failure rates from finished executions only', () => {
    const rates = executionRates(counts(7, 2, 1, 4, 3));
    expect(rates.terminalEligible).toBe(10);
    expect(rates.successRate).toBe(70);
    expect(rates.failureRate).toBe(30);
    expect(rates.total).toBe(17);
  });

  it('returns null rates when nothing has finished', () => {
    const rates = executionRates(counts(0, 0, 0, 1, 2));
    expect(rates.successRate).toBeNull();
    expect(rates.failureRate).toBeNull();
  });

  it('counts a partial execution as not successful', () => {
    const rates = executionRates(counts(0, 0, 2));
    expect(rates.successful).toBe(0);
    expect(rates.failed).toBe(2);
    expect(rates.failureRate).toBe(100);
  });

  it('does not treat retries as extra executions', () => {
    const rates = executionRates(counts(1, 0));
    expect(rates.total).toBe(1);
    expect(rates.successful).toBe(1);
  });

  it('summarizes duration and withholds p95 for a small sample', () => {
    expect(summarizeDurations([10, 30, 20])).toMatchObject({
      sample: 3,
      averageMs: 20,
      medianMs: 20,
      p95Ms: null,
    });
    const large = summarizeDurations([10, 20, 30, 40, 100]);
    expect(large.p95Ms).toBe(100);
    expect(summarizeDurations([-1, Number.NaN])).toMatchObject({
      sample: 0,
      averageMs: null,
    });
  });

  it('keeps health explainable and refuses a score without enough executions', () => {
    const thin = workflowHealth({
      terminalEligible: 2,
      successRate: 100,
      repeatedFailure: false,
      slowVersusPrior: false,
      approvalBottleneck: false,
    });
    expect(thin.label).toBe('INSUFFICIENT_DATA');
    expect(thin.score).toBeNull();
    const healthy = workflowHealth({
      terminalEligible: 10,
      successRate: 90,
      repeatedFailure: false,
      slowVersusPrior: false,
      approvalBottleneck: false,
    });
    expect(healthy).toMatchObject({ score: 90, label: 'HEALTHY' });
    const watched = workflowHealth({
      terminalEligible: 10,
      successRate: 70,
      repeatedFailure: true,
      slowVersusPrior: true,
      approvalBottleneck: false,
    });
    expect(watched.score).toBe(45);
    expect(watched.label).toBe('UNHEALTHY');
    expect(watched.factors.length).toBeGreaterThan(1);
  });

  it('estimates savings only for completed actions with a baseline', () => {
    const estimated = estimateSavings(
      [{ actionType: 'create_task', completed: 2 }],
      DEFAULT_BASELINE_SECONDS,
    );
    expect(estimated.status).toBe('estimated');
    expect(estimated.estimatedSeconds).toBe(360);
    expect(estimated.label).toContain('not measured');
    expect(estimateSavings([], DEFAULT_BASELINE_SECONDS).status).toBe(
      'insufficient',
    );
    expect(
      estimateSavings(
        [{ actionType: 'send_email', completed: 4 }],
        DEFAULT_BASELINE_SECONDS,
      ),
    ).toMatchObject({
      status: 'no_baseline',
      estimatedSeconds: null,
      skippedActions: ['send_email'],
    });
  });

  it('ignores an invalid baseline document and keeps the built-in assumptions', () => {
    expect(parseBaselines('not-json').source).toBe('built_in_assumption');
    expect(parseBaselines('{"create_task":120}').seconds.create_task).toBe(120);
    expect(parseBaselines('{"send_email":10}').source).toBe(
      'built_in_assumption',
    );
  });

  it('sums parent AI runs and does not invent a price or a billed cost', () => {
    const summary = summarizeWorkflowAi([
      {
        parentRunId: null,
        status: 'completed',
        usageStatus: 'reported',
        costStatus: 'estimated',
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14,
        estimatedTotalCost: '0.10000000',
        currency: 'USD',
        durationMs: 100,
      },
      {
        parentRunId: 'parent-1',
        status: 'completed',
        usageStatus: 'reported',
        costStatus: 'estimated',
        inputTokens: 99,
        outputTokens: 99,
        totalTokens: 198,
        estimatedTotalCost: '9.00000000',
        currency: 'USD',
        durationMs: 50,
      },
      {
        parentRunId: null,
        status: 'failed',
        usageStatus: 'unavailable',
        costStatus: 'usage_unavailable',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedTotalCost: null,
        currency: null,
        durationMs: null,
      },
      {
        parentRunId: null,
        status: 'completed',
        usageStatus: 'reported',
        costStatus: 'pricing_not_configured',
        inputTokens: 5,
        outputTokens: 1,
        totalTokens: 6,
        estimatedTotalCost: null,
        currency: null,
        durationMs: 20,
      },
    ]);
    expect(summary.totalRuns).toBe(3);
    expect(summary.failedRuns).toBe(1);
    expect(summary.inputTokens).toBe(15);
    expect(summary.estimatedCost).toBe('0.10000000');
    expect(summary.pricingNotConfiguredRuns).toBe(1);
    expect(summary.billedCost).toBeNull();
    expect(summary.associatedWithExecutions).toBe(false);
  });

  it('does not add estimated costs in different currencies', () => {
    const summary = summarizeWorkflowAi([
      {
        parentRunId: null,
        status: 'completed',
        usageStatus: 'reported',
        costStatus: 'estimated',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedTotalCost: '1.00000000',
        currency: 'USD',
        durationMs: 10,
      },
      {
        parentRunId: null,
        status: 'completed',
        usageStatus: 'reported',
        costStatus: 'estimated',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedTotalCost: '1.00000000',
        currency: 'EUR',
        durationMs: 10,
      },
    ]);
    expect(summary.estimatedCost).toBeNull();
    expect(summary.mixedCurrencies).toBe(true);
  });

  it('builds evidence-based recommendations and drops duplicates', () => {
    const drafts = buildRecommendations({
      failures: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          errorCode: 'not_found',
          count: 8,
        },
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          errorCode: 'not_found',
          count: 8,
        },
        {
          workflowId: 'wf-2',
          workflowName: 'Quiet',
          errorCode: 'invalid_input',
          count: 1,
        },
      ],
      slow: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          actionType: 'create_task',
          currentAvgMs: 3000,
          priorAvgMs: 1000,
          sample: 5,
          priorSample: 5,
        },
      ],
      approvals: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          averageWaitMs: 5 * 60 * 60 * 1000,
          sample: 3,
        },
      ],
      unused: [{ workflowId: 'wf-3', workflowName: 'Dormant' }],
      retries: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          actionType: 'update_lead',
          retriedSteps: 4,
        },
      ],
    });
    expect(drafts.map((draft) => draft.rule)).toEqual([
      'repeated_failure',
      'slow_execution',
      'approval_bottleneck',
      'unused_workflow',
      'repeated_retries',
    ]);
    expect(drafts[0].evidence).toContain('not_found');
    expect(drafts[0].evidence).not.toContain('inactive');
  });

  it('withholds recommendations that do not meet the sample thresholds', () => {
    const drafts = buildRecommendations({
      failures: [],
      slow: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          actionType: 'create_task',
          currentAvgMs: 9000,
          priorAvgMs: 1000,
          sample: 2,
          priorSample: 5,
        },
      ],
      approvals: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          averageWaitMs: 60_000,
          sample: 3,
        },
      ],
      unused: [],
      retries: [
        {
          workflowId: 'wf-1',
          workflowName: 'Follow up',
          actionType: 'create_task',
          retriedSteps: 1,
        },
      ],
    });
    expect(drafts).toEqual([]);
  });

  it('summarizes a large duration sample without retaining failed values', () => {
    const values = Array.from({ length: 5000 }, (_, index) => index);
    const started = Date.now();
    const summary = summarizeDurations(values);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(summary.sample).toBe(5000);
    expect(summary.p95Ms).not.toBeNull();
  });
});
