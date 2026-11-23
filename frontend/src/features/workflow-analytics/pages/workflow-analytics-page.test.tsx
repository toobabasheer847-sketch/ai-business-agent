import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { workflowAnalyticsApi } from '@/features/workflow-analytics/api/workflow-analytics.api'
import { WorkflowAnalyticsPage } from '@/features/workflow-analytics/pages/workflow-analytics-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/workflow-analytics/api/workflow-analytics.api', () => ({
  workflowAnalyticsApi: {
    overview: vi.fn(),
    trends: vi.fn(),
    workflows: vi.fn(),
    workflow: vi.fn(),
    failures: vi.fn(),
    optimizations: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

const overview = vi.mocked(workflowAnalyticsApi.overview)
const trends = vi.mocked(workflowAnalyticsApi.trends)
const workflows = vi.mocked(workflowAnalyticsApi.workflows)
const failures = vi.mocked(workflowAnalyticsApi.failures)
const optimizations = vi.mocked(workflowAnalyticsApi.optimizations)
const updateStatus = vi.mocked(workflowAnalyticsApi.updateStatus)

const savings = {
  status: 'estimated' as const,
  estimatedSeconds: 360,
  label: 'Estimated from configured manual baselines. This is not measured labor time.',
  lines: [{ actionType: 'create_task', completed: 2, baselineSeconds: 180, estimatedSeconds: 360 }],
  skippedActions: [],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkflowAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WorkflowAnalyticsPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.clearAllMocks()
    overview.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      workflows: { total: 1, active: 1, draft: 0, paused: 0 },
      executions: { total: 4, completed: 3, failed: 1, partiallyCompleted: 0, cancelled: 0, running: 0, waiting: 0 },
      rates: { successRate: 75, failureRate: 25, terminalEligible: 4, classification: 'Finished executions only.' },
      duration: { sample: 4, averageMs: 1500, medianMs: 1000, p95Ms: null },
      savings: { ...savings, baselineSource: 'built_in_assumption', today: { ...savings, status: 'insufficient', estimatedSeconds: null }, week: savings, month: savings },
      ai: { totalRuns: 1, failedRuns: 0, inputTokens: 10, outputTokens: 4, totalTokens: 14, estimatedCost: '0.10000000', currency: 'USD', pricingNotConfiguredRuns: 0, billedCost: null, note: 'Generation calls only.', associatedWithExecutions: false },
      health: { healthy: 1, needsAttention: 0, unhealthy: 0, insufficientData: 0 },
    })
    trends.mockResolvedValue({
      days: [{ day: '2026-11-16', executions: 2, completed: 1, failed: 1, partiallyCompleted: 0, averageDurationMs: 1500, estimatedSavingsSeconds: 180, savingsStatus: 'estimated', aiRuns: 0, estimatedAiCost: null }],
    })
    workflows.mockResolvedValue({
      data: [{
        id: 'wf-1',
        name: 'Follow up',
        status: 'active',
        triggerType: 'new_lead',
        executions: 4,
        successRate: 75,
        failureRate: 25,
        averageDurationMs: 1500,
        healthScore: 75,
        healthLabel: 'NEEDS_ATTENTION',
        healthFactors: ['Success rate is 75% of finished executions.'],
        lastExecutionAt: '2026-11-16T12:00:00.000Z',
      }],
      total: 1,
    })
    failures.mockResolvedValue({
      categories: [{ errorCode: 'not_found', count: 3 }],
      workflows: [{ workflowId: 'wf-1', name: 'Follow up', count: 3 }],
      actions: [{ actionType: 'create_task', failed: 3 }],
      recent: [{ executionId: 'run-1', workflowId: 'wf-1', workflowName: 'Follow up', errorCode: 'not_found', sanitizedError: 'Lead was not found.', startedAt: '2026-11-16T12:00:00.000Z' }],
    })
    optimizations.mockResolvedValue({
      data: [{
        id: 'rec-1',
        workflowId: 'wf-1',
        workflowName: 'Follow up',
        rule: 'repeated_failure',
        title: 'Follow up failed repeatedly',
        evidence: 'Follow up recorded 3 finished executions with error not_found.',
        suggestion: 'Confirm the lead still belongs to this tenant.',
        impact: '3 executions ended with not_found.',
        status: 'open',
        detectedAt: '2026-11-16T12:00:00.000Z',
      }],
    })
    updateStatus.mockResolvedValue({ id: 'rec-1', status: 'reviewed' })
  })

  afterEach(() => cleanup())

  it('renders rates, duration, savings, and AI cost from the API', async () => {
    renderPage()
    expect((await screen.findAllByText('75%')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1.5 s').length).toBeGreaterThan(0)
    expect(screen.getAllByText('About 6 min').length).toBeGreaterThan(0)
    expect(screen.getByText('0.10000000 USD')).toBeTruthy()
    expect(screen.getByText('1 healthy')).toBeTruthy()
  })

  it('changes the date range', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await screen.findByText('Execution volume')
    await user.selectOptions(screen.getByLabelText('Date range'), '7d')
    expect(overview).toHaveBeenCalledWith(expect.objectContaining({ range: '7d' }))
  })

  it('shows the execution trend and performance table', async () => {
    renderPage()
    expect(await screen.findByText('2026-11-16')).toBeTruthy()
    expect(screen.getByText('1 ok / 1 failed')).toBeTruthy()
    expect(screen.getByText('Follow up')).toBeTruthy()
    expect(screen.getByText('NEEDS_ATTENTION 75')).toBeTruthy()
  })

  it('shows failure evidence', async () => {
    renderPage()
    expect(await screen.findByText('not_found: 3')).toBeTruthy()
    expect(screen.getByText('create_task failed 3 times')).toBeTruthy()
    expect(screen.getByText('Follow up: Lead was not found.')).toBeTruthy()
  })

  it('marks a recommendation reviewed, dismissed, or applied', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Mark reviewed' }))
    expect(updateStatus).toHaveBeenCalledWith('rec-1', 'reviewed')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(updateStatus).toHaveBeenCalledWith('rec-1', 'dismissed')
    await user.click(screen.getByRole('button', { name: 'Mark applied' }))
    expect(updateStatus).toHaveBeenCalledWith('rec-1', 'applied')
  })

  it('shows an empty state', async () => {
    overview.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      workflows: { total: 0, active: 0, draft: 0, paused: 0 },
      executions: { total: 0, completed: 0, failed: 0, partiallyCompleted: 0, cancelled: 0, running: 0, waiting: 0 },
      rates: { successRate: null, failureRate: null, terminalEligible: 0, classification: 'Finished executions only.' },
      duration: { sample: 0, averageMs: null, medianMs: null, p95Ms: null },
      savings: { status: 'insufficient', estimatedSeconds: null, label: 'Not enough completed actions to estimate time saved.', lines: [], skippedActions: [], baselineSource: 'built_in_assumption', today: { status: 'insufficient', estimatedSeconds: null, label: 'Not enough completed actions to estimate time saved.', lines: [], skippedActions: [] }, week: { status: 'insufficient', estimatedSeconds: null, label: 'Not enough completed actions to estimate time saved.', lines: [], skippedActions: [] }, month: { status: 'insufficient', estimatedSeconds: null, label: 'Not enough completed actions to estimate time saved.', lines: [], skippedActions: [] } },
      ai: { totalRuns: 0, failedRuns: 0, inputTokens: null, outputTokens: null, totalTokens: null, estimatedCost: null, currency: null, pricingNotConfiguredRuns: 0, billedCost: null, note: 'No calls.', associatedWithExecutions: false },
      health: { healthy: 0, needsAttention: 0, unhealthy: 0, insufficientData: 0 },
    })
    workflows.mockResolvedValue({ data: [], total: 0 })
    failures.mockResolvedValue({ categories: [], workflows: [], actions: [], recent: [] })
    optimizations.mockResolvedValue({ data: [] })
    trends.mockResolvedValue({ days: [] })
    renderPage()
    expect(await screen.findByText('No workflow activity')).toBeTruthy()
    expect(await screen.findByText('No optimization recommendations')).toBeTruthy()
  })

  it('shows an error and retries', async () => {
    overview.mockRejectedValue(new Error('down'))
    const user = userEvent.setup({ delay: null })
    renderPage()
    expect(await screen.findByText('Workflow analytics are unavailable')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(overview.mock.calls.length).toBeGreaterThan(1)
  })

  it('hides analytics from a member', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Workflow analytics are limited to managers')).toBeTruthy()
    expect(overview).not.toHaveBeenCalled()
  })
})
