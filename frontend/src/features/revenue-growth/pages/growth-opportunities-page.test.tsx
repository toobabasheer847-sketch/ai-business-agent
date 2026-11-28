import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { growthApi } from '@/features/revenue-growth/api/growth.api'
import { GrowthOpportunitiesPage } from '@/features/revenue-growth/pages/growth-opportunities-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined, isBootstrapping: false, id: 'user-1' }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: auth.id, name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: auth.isBootstrapping }),
}))

vi.mock('@/features/revenue-growth/api/growth.api', () => ({
  growthApi: {
    analytics: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
    refresh: vi.fn(),
    updateStatus: vi.fn(),
    assign: vi.fn(),
    createTask: vi.fn(),
    createPlan: vi.fn(),
    completePlan: vi.fn(),
    draft: vi.fn(),
    plans: vi.fn(),
  },
}))

const opportunity = {
  id: 'opp-1',
  companyId: 'company-1',
  companyName: 'Northwind',
  leadId: 'lead-1',
  prospectId: null,
  proposalId: null,
  opportunityType: 'stalled_sales',
  title: 'Review a quiet lead',
  description: 'The lead has no stored update inside the configured window. This is not a lost sale.',
  evidence: 'Ada was last updated at 2026-10-01. Status remains new.',
  explicit: false,
  sourceType: 'lead',
  sourceId: 'lead-1',
  priority: 'low',
  priorityRank: 1,
  prioritySource: 'heuristic',
  confidence: 'low',
  status: 'identified',
  recommendedAction: 'Decide whether a person should follow up.',
  assignedTo: null,
  taskId: null,
  outcome: null,
  createdAt: '2026-11-26T00:00:00.000Z',
  revenue: null,
  proposalValue: null,
  predictiveModel: false as const,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GrowthOpportunitiesPage />
    </QueryClientProvider>,
  )
}

describe('GrowthOpportunitiesPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    auth.isBootstrapping = false
    vi.mocked(growthApi.analytics).mockResolvedValue({
      total: 1,
      byType: { stalled_sales: 1 },
      byStatus: { identified: 1 },
      byPriority: { low: 1 },
      highPriority: 0,
      awaitingReview: 1,
      withPlans: 0,
      overdueLinked: 0,
      won: 0,
      lost: 0,
      converted: 0,
      insufficientLeads: 0,
      revenue: null,
      proposalValue: null,
      conversionRate: null,
      method: 'heuristic',
      predictiveModel: false,
      scoring: 'Rank 1 is a quiet lead.',
      note: 'Counts are stored opportunities. Priority is not money.',
      truncated: false,
    })
    vi.mocked(growthApi.list).mockResolvedValue({ data: [opportunity], total: 1 })
    vi.mocked(growthApi.detail).mockResolvedValue({ opportunity, events: [], plans: [] })
    vi.mocked(growthApi.updateStatus).mockResolvedValue(opportunity)
  })

  afterEach(() => cleanup())

  it('shows stored evidence and does not present a revenue figure', async () => {
    renderPage()
    expect(await screen.findByText(/Revenue is not calculated/)).toBeTruthy()
    expect(screen.getByText('Ada was last updated at 2026-10-01. Status remains new.')).toBeTruthy()
    expect(screen.getByText(/confidence low/)).toBeTruthy()
    expect(screen.getByText('Decide whether a person should follow up.')).toBeTruthy()
    expect(screen.queryByText(/\$/)).toBeNull()
  })

  it('filters stalled opportunities and opens review', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Ada was last updated at 2026-10-01. Status remains new.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Stalled' }))
    expect(growthApi.list).toHaveBeenCalledWith('stalled_sales')
    await user.click(await screen.findByText('Review a quiet lead'))
    await user.click(await screen.findByRole('button', { name: 'Review' }))
    expect(growthApi.updateStatus).toHaveBeenCalledWith('opp-1', 'needs_review', undefined)
  })

  it('shows an empty state when the filter has no rows', async () => {
    vi.mocked(growthApi.list).mockResolvedValue({ data: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No stored opportunities')).toBeTruthy()
  })

  it('blocks a member and shows an error for a manager when counts fail', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Growth opportunities are limited to managers')).toBeTruthy()
    cleanup()
    auth.role = 'admin'
    vi.mocked(growthApi.analytics).mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('Growth counts could not be loaded.')).toBeTruthy()
  })

  it('shows a loading state while counts are pending', () => {
    vi.mocked(growthApi.analytics).mockReturnValue(new Promise(() => undefined))
    renderPage()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })

  it('qualifies, assigns, creates a task, and records a dismissal', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(growthApi.detail).mockResolvedValue({
      opportunity: { ...opportunity, status: 'needs_review' },
      events: [{ id: 'event-1', fromStatus: 'identified', toStatus: 'needs_review', note: 'Reviewed.', createdAt: '2026-11-26T00:00:00.000Z' }],
      plans: [],
    })
    vi.mocked(growthApi.assign).mockResolvedValue(opportunity)
    vi.mocked(growthApi.createTask).mockResolvedValue({ taskId: 'task-1', duplicate: false })
    renderPage()
    await user.click(await screen.findByText('Review a quiet lead'))
    expect(await screen.findByText(/Reviewed\./)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Qualify' }))
    expect(growthApi.updateStatus).toHaveBeenCalledWith('opp-1', 'qualified', undefined)
    await user.click(screen.getByRole('button', { name: 'Assign to me' }))
    expect(growthApi.assign).toHaveBeenCalledWith('opp-1', 'user-1')
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(growthApi.createTask).toHaveBeenCalledWith('opp-1')
    await user.type(screen.getByRole('textbox', { name: 'Outcome' }), 'Not a fit')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(growthApi.updateStatus).toHaveBeenCalledWith('opp-1', 'dismissed', 'Not a fit')
  })

  it('creates an action plan and records its outcome', async () => {
    const user = userEvent.setup()
    vi.mocked(growthApi.detail).mockResolvedValue({
      opportunity: { ...opportunity, status: 'qualified' },
      events: [],
      plans: [{ id: 'plan-1', opportunityId: 'opp-1', objective: 'Call the lead', expectedOutcome: 'A recorded next step', actualOutcome: null, status: 'open', priority: 'low', dueAt: null, taskId: null }],
    })
    vi.mocked(growthApi.createPlan).mockResolvedValue({})
    vi.mocked(growthApi.completePlan).mockResolvedValue({})
    renderPage()
    await user.click(await screen.findByText('Review a quiet lead'))
    await user.type(await screen.findByRole('textbox', { name: 'Action objective' }), 'Prepare a follow-up')
    await user.click(screen.getByRole('button', { name: 'Create action plan' }))
    expect(growthApi.createPlan).toHaveBeenCalledWith({ opportunityId: 'opp-1', objective: 'Prepare a follow-up', expectedOutcome: 'A person reviews the stored evidence and records what happened.' })
    await user.type(screen.getByRole('textbox', { name: 'Actual outcome' }), 'Called and logged the reply')
    await user.click(screen.getByRole('button', { name: 'Record plan outcome' }))
    expect(growthApi.completePlan).toHaveBeenCalledWith('plan-1', 'Called and logged the reply')
  })
})
