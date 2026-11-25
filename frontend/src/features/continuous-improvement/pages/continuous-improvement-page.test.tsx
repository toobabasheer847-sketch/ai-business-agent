import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { continuousImprovementApi } from '@/features/continuous-improvement/api/continuous-improvement.api'
import { ContinuousImprovementPage } from '@/features/continuous-improvement/pages/continuous-improvement-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined, isBootstrapping: false }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: auth.isBootstrapping }),
}))

vi.mock('@/features/continuous-improvement/api/continuous-improvement.api', () => ({
  continuousImprovementApi: {
    overview: vi.fn(),
    deviations: vi.fn(),
    bottlenecks: vi.fn(),
    reviewBottleneck: vi.fn(),
    resolveBottleneck: vi.fn(),
    recommendations: vi.fn(),
    refresh: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    feedback: vi.fn(),
    plans: vi.fn(),
    createPlan: vi.fn(),
    activate: vi.fn(),
    hold: vi.fn(),
    completePlan: vi.fn(),
    completeMilestone: vi.fn(),
    outcomes: vi.fn(),
    evaluate: vi.fn(),
    reviews: vi.fn(),
    createReview: vi.fn(),
    completeReview: vi.fn(),
    history: vi.fn(),
  },
}))

const overview = vi.mocked(continuousImprovementApi.overview)
const bottlenecks = vi.mocked(continuousImprovementApi.bottlenecks)
const recommendations = vi.mocked(continuousImprovementApi.recommendations)
const plans = vi.mocked(continuousImprovementApi.plans)
const outcomes = vi.mocked(continuousImprovementApi.outcomes)
const reviews = vi.mocked(continuousImprovementApi.reviews)
const history = vi.mocked(continuousImprovementApi.history)
const refresh = vi.mocked(continuousImprovementApi.refresh)
const accept = vi.mocked(continuousImprovementApi.accept)
const resolveBottleneck = vi.mocked(continuousImprovementApi.resolveBottleneck)
const createPlan = vi.mocked(continuousImprovementApi.createPlan)
const completeReview = vi.mocked(continuousImprovementApi.completeReview)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContinuousImprovementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ContinuousImprovementPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    auth.isBootstrapping = false
    vi.clearAllMocks()
    overview.mockResolvedValue({
      cycle: { stages: ['OBSERVE', 'ANALYZE'], current: 'ANALYZE' },
      activePlans: [],
      goalsAtRisk: [{ id: 'goal-1', name: 'Fewer overdue tasks', note: '40% of the way from the baseline to the target.' }],
      deviations: [{
        metricKey: 'overdue_task_count',
        metricName: 'Overdue tasks',
        deviationType: 'NEGATIVE',
        currentValue: 20,
        baselineValue: 8,
        targetValue: null,
        deviationValue: 12,
        deviationPercentage: 150,
        trendDirection: 'up',
        confidenceLevel: 'HIGH',
        evidence: ['Overdue tasks is 20 compared with a baseline of 8.'],
      }],
      bottlenecks: [],
      recommendations: [],
      opportunities: [{ key: 'workflow_configuration', title: 'Review repeated workflow failures', suggestedImprovement: 'Review the workflow configuration.', potentialBenefit: 'No time saving is calculated.' }],
      schedule: { note: 'Manual refresh works without Redis.' },
      classification: { observed: 'Counts come from stored records.', causal: 'Observed changes are not described as caused by an action.' },
    })
    bottlenecks.mockResolvedValue({
      data: [{
        id: 'bottle-1',
        title: 'Workflow executions are failing',
        category: 'automation',
        severity: 'high',
        affectedProcess: 'Workflow execution',
        status: 'open',
        evidence: ['4 failed executions were stored.'],
        recommendedInvestigation: 'Open workflow analytics before increasing automation.',
        confidenceLevel: 'HIGH',
      }],
    })
    recommendations.mockResolvedValue({
      data: [{
        id: 'rec-1',
        title: 'Review overdue milestones',
        description: 'A plan has an overdue milestone.',
        evidence: ['A milestone due date has passed.'],
        priorityScore: 80,
        confidenceLevel: 'HIGH',
        expectedOutcome: 'A person can revise the schedule.',
        status: 'open',
        risks: 'Generating this recommendation does not change a plan.',
      }],
    })
    plans.mockResolvedValue({
      data: [{
        id: 'plan-1',
        title: 'Improve task completion',
        objective: 'Lower the overdue count.',
        status: 'ACTIVE',
        ownerId: null,
        baselineValue: '20.0000',
        targetValue: '4.0000',
        reviewSchedule: 'monthly',
        nextReviewAt: null,
        milestones: [{ id: 'mile-1', title: 'Review the overdue task list', status: 'pending' }],
        assessment: { progressStatus: 'on_track', executionProgress: 0, outcomeProgress: 40, reason: 'Execution and outcome are separate.' },
      }],
    })
    outcomes.mockResolvedValue({
      data: [{
        id: 'out-1',
        metricKey: 'overdue_task_count',
        baselineValue: '24.0000',
        measuredValue: '17.0000',
        evaluationStatus: 'POSITIVE_OBSERVED_CHANGE',
        evaluationPeriodStart: '2026-10-01T00:00:00.000Z',
        evaluationPeriodEnd: '2026-10-29T00:00:00.000Z',
        evidence: { statement: 'The metric was 24 at baseline and 17 in the window. This does not show that an action caused the change.', causalClaim: false },
      }],
    })
    reviews.mockResolvedValue({
      data: [{ id: 'review-1', status: 'draft', summary: 'Review for the last 30 days.', decision: null }],
    })
    history.mockResolvedValue({
      data: [{ id: 'event-1', eventType: 'recommendation_generated', relatedEntityType: 'strategic_recommendation', occurredAt: '2026-11-25T00:00:00.000Z', actorId: null }],
    })
    refresh.mockResolvedValue({ executed: 0 })
    accept.mockResolvedValue({})
    resolveBottleneck.mockResolvedValue({})
    createPlan.mockResolvedValue({})
    completeReview.mockResolvedValue({})
  })

  afterEach(() => cleanup())

  it('shows the cycle, a deviation, and the causal limit', async () => {
    renderPage()
    expect(await screen.findByText('ANALYZE')).toBeTruthy()
    expect(screen.getByText('Overdue tasks')).toBeTruthy()
    expect(screen.getByText(/not described as caused/)).toBeTruthy()
    expect(screen.getByText(/Causal conclusion: not claimed/)).toBeTruthy()
  })

  it('refreshes, resolves a bottleneck, accepts a recommendation, and saves a plan', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Workflow executions are failing')
    await user.click(screen.getByRole('button', { name: 'Refresh monitoring' }))
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await user.click(screen.getByRole('button', { name: 'Save draft plan' }))
    expect(refresh).toHaveBeenCalled()
    expect(resolveBottleneck).toHaveBeenCalledWith('bottle-1', expect.anything())
    expect(accept).toHaveBeenCalledWith('rec-1', expect.anything())
    expect(createPlan).toHaveBeenCalled()
  })

  it('shows plan progress and completes a review', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/Execution 0%/)).toBeTruthy()
    expect(screen.getByText('recommendation_generated')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Complete review' }))
    expect(completeReview).toHaveBeenCalledWith('review-1', 'Keep the current plans and review the open bottleneck.')
  })

  it('shows an empty deviation state', async () => {
    overview.mockResolvedValue({
      cycle: { stages: ['OBSERVE'], current: 'OBSERVE' },
      activePlans: [],
      goalsAtRisk: [],
      deviations: [],
      bottlenecks: [],
      recommendations: [],
      opportunities: [],
      schedule: { note: 'Manual refresh works without Redis.' },
      classification: { observed: 'Counts come from stored records.', causal: 'Observed changes are not described as caused by an action.' },
    })
    bottlenecks.mockResolvedValue({ data: [] })
    recommendations.mockResolvedValue({ data: [] })
    plans.mockResolvedValue({ data: [] })
    outcomes.mockResolvedValue({ data: [] })
    reviews.mockResolvedValue({ data: [] })
    history.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('No material deviation')).toBeTruthy()
    expect(screen.getByText('No saved bottleneck')).toBeTruthy()
    expect(screen.getByText('No improvement history yet')).toBeTruthy()
  })

  it('offers a retry when the overview fails', async () => {
    const user = userEvent.setup()
    overview.mockRejectedValueOnce(new Error('down'))
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(overview).toHaveBeenCalledTimes(2)
  })

  it('hides the center from a member', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Continuous improvement is limited to managers')).toBeTruthy()
    expect(overview).not.toHaveBeenCalled()
  })

  it('shows a loading skeleton while access is loading', () => {
    auth.isBootstrapping = true
    const { container } = renderPage()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })
})
