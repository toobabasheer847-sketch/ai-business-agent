import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { strategicDecisionApi } from '@/features/strategic-decisions/api/strategic-decisions.api'
import { StrategicDecisionsPage } from '@/features/strategic-decisions/pages/strategic-decisions-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/strategic-decisions/api/strategic-decisions.api', () => ({
  strategicDecisionApi: {
    overview: vi.fn(),
    recommendations: vi.fn(),
    refresh: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    feedback: vi.fn(),
    plans: vi.fn(),
    createPlan: vi.fn(),
    actionPlans: vi.fn(),
    createActionPlan: vi.fn(),
    execute: vi.fn(),
    completeStep: vi.fn(),
    goals: vi.fn(),
    createGoal: vi.fn(),
  },
}))

const overview = vi.mocked(strategicDecisionApi.overview)
const recommendations = vi.mocked(strategicDecisionApi.recommendations)
const accept = vi.mocked(strategicDecisionApi.accept)
const plans = vi.mocked(strategicDecisionApi.plans)
const actions = vi.mocked(strategicDecisionApi.actionPlans)
const goals = vi.mocked(strategicDecisionApi.goals)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StrategicDecisionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StrategicDecisionsPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.clearAllMocks()
    overview.mockResolvedValue({
      priorities: [{ key: 'overdue_tasks', title: 'Several tasks are overdue now', score: 64, evidence: '6 open tasks are overdue now.', action: 'Review the overdue task list.', confidence: 'HIGH' }],
      opportunities: [{ key: 'follow_up', name: 'Review leads that are still new', benefit: 'No revenue change is estimated.', limitation: 'No monetary savings or revenue growth is calculated.' }],
      outcomes: { summary: 'No recommendation has been accepted or rejected yet.' },
      schedule: { note: 'Manual refresh does not need Redis.' },
      classification: { recommendations: 'Recommendations are suggestions.' },
    })
    recommendations.mockResolvedValue({
      data: [{
        id: 'rec-1',
        title: 'Several tasks are overdue now',
        description: 'Current count.',
        category: 'operations',
        priorityScore: 64,
        confidenceLevel: 'HIGH',
        evidence: ['6 open tasks are overdue now.'],
        reasoning: 'The score is not a probability.',
        suggestedAction: 'Review the overdue task list.',
        expectedOutcome: 'The count is not described as an increase.',
        status: 'open',
      }],
    })
    plans.mockResolvedValue({ data: [{ id: 'plan-1', title: 'Reduce overdue tasks', objective: 'Lower the current count.', status: 'DRAFT', metricKey: 'overdue_task_count', baselineValue: '6.0000', targetValue: '6.0000', progress: null, progressNote: 'Progress is withheld until the target differs from the baseline.' }] })
    actions.mockResolvedValue({
      data: [{
        id: 'action-1',
        title: 'Follow up',
        status: 'ready',
        steps: [{ id: 'step-1', title: 'Review the evidence', actionType: 'review', status: 'pending', note: null }],
      }],
    })
    goals.mockResolvedValue({ data: [{ id: 'goal-1', name: 'Fewer overdue tasks', metricKey: 'overdue_task_count', baselineValue: '6.0000', currentValue: '6.0000', targetValue: '0.0000', progress: 0, progressNote: '0% of the gap from the baseline to the target. This is not a cause.' }] })
    accept.mockResolvedValue({})
  })

  afterEach(() => cleanup())

  it('shows evidence, a score, and the boundary on money', async () => {
    renderPage()
    expect(await screen.findByText('Priority score 64. Confidence HIGH.')).toBeTruthy()
    expect(screen.getByText('No monetary savings or revenue growth is calculated.')).toBeTruthy()
    expect(screen.getByText('The score is not a probability.')).toBeTruthy()
    expect(screen.getByText('Manual refresh does not need Redis.')).toBeTruthy()
    expect(screen.getByText('Status DRAFT. Metric overdue_task_count.')).toBeTruthy()
    expect(screen.getByText('review: pending')).toBeTruthy()
    expect(screen.getByText('0% of the gap from the baseline to the target. This is not a cause.')).toBeTruthy()
  })

  it('accepts a recommendation through the API', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Accept' }, { timeout: 4000 })
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Accept' }))
    expect(accept).toHaveBeenCalledWith('rec-1', expect.anything())
  })

  it('does not load tenant priorities for a member', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Strategic decisions are limited to managers')).toBeTruthy()
    expect(overview).not.toHaveBeenCalled()
  })

  it('retries after an overview error', async () => {
    overview.mockRejectedValueOnce(new Error('down'))
    renderPage()
    expect(await screen.findByText('Strategic decisions could not be loaded')).toBeTruthy()
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Priority score 64. Confidence HIGH.')).toBeTruthy()
  })
})
