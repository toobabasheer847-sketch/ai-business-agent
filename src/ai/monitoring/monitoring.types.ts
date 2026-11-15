export type RunStatus = 'running' | 'completed' | 'failed';
export type UsageStatus = 'reported' | 'unavailable';
export type CostStatus = 'estimated' | 'pricing_not_configured' | 'usage_unavailable';

export type AgentRunRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  agentName: string;
  correlationId: string;
  parentRunId: string | null;
  providerExecutionId: string;
  provider: string;
  model: string;
  status: RunStatus;
  usageStatus: UsageStatus;
  usageNote: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costStatus: CostStatus;
  estimatedInputCost: string | null;
  estimatedOutputCost: string | null;
  estimatedTotalCost: string | null;
  currency: string | null;
  pricingSource: string | null;
  pricingEffectiveDate: string | null;
  durationMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  errorSummary: string | null;
};

export type MonitoringScope = {
  tenantId: string;
  userId?: string;
};

export type MonitoringQuery = {
  page: number;
  limit: number;
  offset: number;
  from?: Date;
  to?: Date;
  agent?: string;
  provider?: string;
  model?: string;
  status?: RunStatus;
};

export type AgentRunView = {
  id: string;
  tenantId: string;
  userId: string | null;
  agentName: string;
  correlationId: string;
  parentRunId: string | null;
  providerExecutionId: string;
  provider: string;
  model: string;
  status: RunStatus;
  usageStatus: UsageStatus;
  usageNote: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costStatus: CostStatus;
  estimatedInputCost: string | null;
  estimatedOutputCost: string | null;
  estimatedTotalCost: string | null;
  currency: string | null;
  pricingSource: string | null;
  pricingEffectiveDate: string | null;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorSummary: string | null;
};

export type MonitoringSummary = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  runningRuns: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageUnavailableRuns: number;
  estimatedCost: string | null;
  currency: string | null;
  mixedCurrencies: boolean;
  pricingNotConfiguredRuns: number;
  averageDurationMs: number | null;
  usageOverTime: Array<{ day: string; runs: number }>;
  usageOverTimeTruncated: boolean;
  costByModel: Array<{ provider: string; model: string; runs: number; estimatedCost: string | null; currency: string | null }>;
  runsByAgent: Array<{ agent: string; runs: number }>;
};
