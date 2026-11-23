import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { dashboardApi } from '@/features/dashboard/api/dashboard.api'
import { exceptionsApi } from '@/features/exceptions/api/exceptions.api'
import { workflowAnalyticsApi } from '@/features/workflow-analytics/api/workflow-analytics.api'
import { workflowsApi } from '@/features/workflows/api/workflows.api'

const auth = vi.hoisted(() => ({ role: undefined as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/exceptions/api/exceptions.api', () => ({
  exceptionsApi: {
    summary: vi.fn(),
    attention: vi.fn(),
  },
}))

vi.mock('@/features/workflows/api/workflows.api', () => ({
  workflowsApi: {
    summary: vi.fn(),
  },
}))

vi.mock('@/features/workflow-analytics/api/workflow-analytics.api', () => ({
  workflowAnalyticsApi: {
    overview: vi.fn(),
  },
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  dashboardApi: {
    overview: vi.fn(),
    salesPipeline: vi.fn(),
    tasksSummary: vi.fn(),
    recentActivity: vi.fn(),
    communicationsSummary: vi.fn(),
  },
}))

const overview = vi.mocked(dashboardApi.overview)
const pipeline = vi.mocked(dashboardApi.salesPipeline)
const tasks = vi.mocked(dashboardApi.tasksSummary)
const activity = vi.mocked(dashboardApi.recentActivity)
const communications = vi.mocked(dashboardApi.communicationsSummary)
const exceptionSummary = vi.mocked(exceptionsApi.summary)
const attention = vi.mocked(exceptionsApi.attention)
const workflowSummary = vi.mocked(workflowsApi.summary)
const workflowAnalytics = vi.mocked(workflowAnalyticsApi.overview)

const lifetimeCounts = {
  companies: 4,
  leads: 7,
  prospects: 3,
  proposals: 2,
  draftProposals: 1,
  generatedProposals: 0,
  sentProposals: 1,
  viewedProposals: 0,
  acceptedProposals: 1,
  rejectedProposals: 0,
  pendingTasks: 5,
  completedTasks: 2,
  overdueTasks: 1,
}

function renderDashboard(className = '') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <div className={className}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </div>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    auth.role = undefined
    vi.clearAllMocks()
    exceptionSummary.mockResolvedValue({
      open: 1,
      critical: 1,
      high: 0,
      acknowledged: 0,
      resolved: 0,
      resolvedToday: 0,
      categories: { task: 1 },
      insight: 'Suggestion, not a verified forecast: 1 open exception, including 1 critical and 0 high.',
      insightSource: 'rule',
    })
    attention.mockResolvedValue([{
      id: 'ex-1',
      exceptionKey: 'task:task-1',
      category: 'task',
      severity: 'critical',
      title: 'Task needs attention: Invoice',
      description: 'This task is overdue by 4 days and is still pending.',
      sourceType: 'task',
      sourceId: 'task-1',
      status: 'open',
      detectedAt: '2026-11-16T12:00:00.000Z',
      lastDetectedAt: '2026-11-16T12:00:00.000Z',
      occurrenceCount: 1,
      priorityScore: 90,
      priorityReason: 'Priority 90 because this is Critical severity, not yet acknowledged.',
      recommendedAction: 'Review the task.',
      recommendedActionType: 'review_task',
      assignedTo: null,
      acknowledgedAt: null,
      resolvedAt: null,
      dismissedAt: null,
      resolutionNote: null,
      metadata: {},
    }])
    workflowAnalytics.mockResolvedValue({
      window: { preset: '7d', from: '2026-11-09T12:00:00.000Z', to: '2026-11-16T12:00:00.000Z', timezone: 'UTC' },
      workflows: { total: 2, active: 1, draft: 1, paused: 0 },
      executions: { total: 4, completed: 3, failed: 1, partiallyCompleted: 0, cancelled: 0, running: 0, waiting: 0 },
      rates: { successRate: 75, failureRate: 25, terminalEligible: 4, classification: 'Finished executions only.' },
      duration: { sample: 4, averageMs: 1200, medianMs: 1000, p95Ms: null },
      savings: {
        status: 'estimated',
        estimatedSeconds: 360,
        label: 'Estimated from configured manual baselines. This is not measured labor time.',
        lines: [],
        skippedActions: [],
        baselineSource: 'built_in_assumption',
        today: { status: 'insufficient', estimatedSeconds: null, label: 'Not enough completed actions to estimate time saved.', lines: [], skippedActions: [] },
        week: { status: 'estimated', estimatedSeconds: 360, label: 'Estimated from configured manual baselines. This is not measured labor time.', lines: [], skippedActions: [] },
        month: { status: 'estimated', estimatedSeconds: 360, label: 'Estimated from configured manual baselines. This is not measured labor time.', lines: [], skippedActions: [] },
      },
      ai: { totalRuns: 0, failedRuns: 0, inputTokens: null, outputTokens: null, totalTokens: null, estimatedCost: null, currency: null, pricingNotConfiguredRuns: 0, billedCost: null, note: 'No workflow-generation model calls were recorded.', associatedWithExecutions: false },
      health: { healthy: 0, needsAttention: 1, unhealthy: 0, insufficientData: 1 },
    })
    workflowSummary.mockResolvedValue({
      total: 2,
      active: 1,
      paused: 0,
      draft: 1,
      completed: 3,
      failed: 1,
      waiting: 1,
      recentFailures: [{
        id: 'run-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        triggerSource: 'manual',
        triggerReference: 'manual:1',
        status: 'failed',
        startedAt: '2026-11-16T12:00:00.000Z',
        completedAt: '2026-11-16T12:00:01.000Z',
        durationMs: 1000,
        errorCode: 'invalid_input',
        sanitizedError: 'The task title is missing.',
      }],
    })
    overview.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      lifetime: lifetimeCounts,
      filtered: null,
    })
    pipeline.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      lifetime: {
        companies: 4,
        leads: 7,
        prospects: 3,
        proposals: 2,
        companiesWithLeads: 3,
        leadsWithProspects: 2,
        prospectsWithProposals: 1,
      },
      filtered: null,
    })
    tasks.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      current: { pending: 5, completed: 2, overdue: 1, dueToday: 1, dueThisWeek: 3 },
      filtered: null,
    })
    activity.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      items: [
        { id: '1', kind: 'proposal.sent', title: 'Harbor rollout', occurredAt: '2026-11-14T12:00:00.000Z' },
      ],
    })
    communications.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      lifetime: {
        totalConversations: 6,
        emailConversations: 3,
        smsConversations: 2,
        callConversations: 1,
        webConversations: 0,
      },
      filtered: null,
      recent: [
        { id: 'c1', channel: 'email', title: 'Follow up', status: 'active', updatedAt: '2026-11-14T12:00:00.000Z' },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders KPI cards from the dashboard API', async () => {
    renderDashboard()
    expect(await screen.findByRole('heading', { name: 'Welcome back, Ada' })).toBeTruthy()
    expect(await screen.findByText('Harbor rollout')).toBeTruthy()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByText('Sales pipeline')).toBeTruthy()
    expect(screen.getByText('Follow up')).toBeTruthy()
    expect(screen.getByTestId('kpi-grid').className).toContain('grid-cols-1')
    expect(screen.getByTestId('kpi-grid').className).toContain('sm:grid-cols-2')
    expect(screen.getByTestId('kpi-grid').className).toContain('xl:grid-cols-4')
    expect(screen.queryByText('Business Needs Attention')).toBeNull()
    expect(screen.queryByText('Workflow automation')).toBeNull()
    expect(exceptionSummary).not.toHaveBeenCalled()
    expect(workflowSummary).not.toHaveBeenCalled()
    expect(workflowAnalytics).not.toHaveBeenCalled()
  })

  it('shows unresolved exceptions to a manager without loading CRM lists', async () => {
    auth.role = 'admin'
    renderDashboard()
    expect(await screen.findByText('Business Needs Attention')).toBeTruthy()
    expect(await screen.findByText('1 unresolved exceptions.')).toBeTruthy()
    expect(await screen.findByText('Critical: Task needs attention: Invoice')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View all exceptions' }).getAttribute('href')).toBe('/exceptions')
    expect(await screen.findByText('Workflow automation')).toBeTruthy()
    expect(await screen.findByText('1 active workflows.')).toBeTruthy()
    expect(await screen.findByText('Failed: The task title is missing.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Workflow analytics' }).getAttribute('href')).toBe('/workflow-analytics')
    expect(await screen.findByText('75% of finished executions succeeded in the last 7 days.')).toBeTruthy()
    expect(screen.getByText('Estimated time saved: about 6 min. This is not measured labor time.')).toBeTruthy()
    expect(screen.getByText('1 workflow needs attention.')).toBeTruthy()
    expect(exceptionSummary).toHaveBeenCalledTimes(1)
    expect(workflowSummary).toHaveBeenCalledTimes(1)
    expect(attention).toHaveBeenCalledTimes(1)
  })

  it('shows skeletons while the overview is loading', () => {
    overview.mockReturnValue(new Promise(() => undefined))
    renderDashboard()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })

  it('shows an empty state when the tenant has no records', async () => {
    const empty = { ...lifetimeCounts, companies: 0, leads: 0, prospects: 0, proposals: 0, draftProposals: 0, sentProposals: 0, acceptedProposals: 0, rejectedProposals: 0, pendingTasks: 0, completedTasks: 0, overdueTasks: 0 }
    overview.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      lifetime: empty,
      filtered: null,
    })
    activity.mockResolvedValue({
      window: { preset: 'lifetime', from: null, to: null, timezone: 'UTC' },
      items: [],
    })
    renderDashboard()
    expect(await screen.findByText(/No CRM records yet/)).toBeTruthy()
    expect(screen.getByText('No activity in this period.')).toBeTruthy()
  })

  it('shows an error and retries the overview request', async () => {
    overview.mockRejectedValueOnce(new Error('Dashboard unavailable'))
    const user = userEvent.setup()
    renderDashboard()
    expect(await screen.findByText('Dashboard unavailable')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(overview.mock.calls.length).toBeGreaterThan(1)
  })

  it('requests the last 7 days when that filter is selected', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByRole('heading', { name: 'Welcome back, Ada' })
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(overview).toHaveBeenCalledWith({ range: '7d' })
  })

  it('keeps the same KPI labels in light and dark theme wrappers', async () => {
    const light = renderDashboard()
    expect((await screen.findAllByText('Companies')).length).toBeGreaterThan(0)
    light.unmount()
    renderDashboard('dark')
    expect((await screen.findAllByText('Companies')).length).toBeGreaterThan(0)
    expect(document.querySelector('.dark')).toBeTruthy()
  })
})
