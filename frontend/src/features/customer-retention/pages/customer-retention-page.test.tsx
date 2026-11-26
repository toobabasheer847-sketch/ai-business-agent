import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { customerRetentionApi } from '@/features/customer-retention/api/customer-retention.api'
import { CustomerRetentionPage } from '@/features/customer-retention/pages/customer-retention-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined, isBootstrapping: false }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: auth.isBootstrapping }),
}))

vi.mock('@/features/customer-retention/api/customer-retention.api', () => ({
  customerRetentionApi: {
    analytics: vi.fn(),
    accounts: vi.fn(),
    account: vi.fn(),
    refresh: vi.fn(),
    recommendations: vi.fn(),
    updateRecommendation: vi.fn(),
    createTask: vi.fn(),
    plans: vi.fn(),
    createPlan: vi.fn(),
    completePlan: vi.fn(),
    draft: vi.fn(),
  },
}))

const account = {
  id: 'account-1',
  companyId: 'company-1',
  companyName: 'Northwind',
  classification: 'at_risk' as const,
  confidence: 'medium',
  dataSufficiency: 'adequate',
  explanation: 'An inbound message has no later outbound message.',
  signals: [{ code: 'unanswered_message', sourceType: 'message', sourceId: 'message-1', observedAt: '2026-11-20T00:00:00.000Z', summary: 'Inbound message message-1 is unanswered.', fact: true as const }],
  lastInteractionAt: '2026-11-20T00:00:00.000Z',
  assessedAt: '2026-11-26T00:00:00.000Z',
  method: 'heuristic' as const,
  predictiveModel: false as const,
  churnProbability: null,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CustomerRetentionPage /></QueryClientProvider>)
}

describe('customer retention page', () => {
  beforeEach(() => {
    auth.role = 'admin'
    auth.isBootstrapping = false
    vi.mocked(customerRetentionApi.analytics).mockResolvedValue({
      customers: 1,
      healthy: 0,
      attentionNeeded: 0,
      atRisk: 1,
      insufficientData: 0,
      inactive: 0,
      openRecommendations: 1,
      completedPlans: 0,
      overdueFollowUps: 0,
      unresolvedConversations: 0,
      followUpCompletion: null,
      churnRate: null,
      retentionRate: null,
      customerLifetimeValue: null,
      note: 'Classifications are heuristic.',
    })
    vi.mocked(customerRetentionApi.accounts).mockResolvedValue({ data: [account], total: 1 })
    vi.mocked(customerRetentionApi.account).mockResolvedValue({
      account,
      recommendations: [{ id: 'rec-1', companyId: 'company-1', title: 'Respond to the unanswered message', explanation: 'No later outbound message.', action: 'Reply after approval.', priority: 'high', status: 'open', confidence: 'medium', evidence: 'Inbound message message-1 is unanswered.', taskId: null }],
      plans: [],
    })
    vi.mocked(customerRetentionApi.recommendations).mockResolvedValue([{
      id: 'rec-1', companyId: 'company-1', title: 'Respond to the unanswered message', explanation: 'No later outbound message.', action: 'Reply after approval.', priority: 'high', status: 'open', confidence: 'medium', evidence: 'Inbound message message-1 is unanswered.', taskId: null,
    }])
    vi.mocked(customerRetentionApi.plans).mockResolvedValue([])
    vi.mocked(customerRetentionApi.createTask).mockResolvedValue({ taskId: 'task-1', duplicate: false })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows heuristic counts and does not present a churn rate', async () => {
    renderPage()
    expect(await screen.findByText(/Classifications are heuristic/)).toBeTruthy()
    expect(screen.getByText(/not calculated/)).toBeTruthy()
    expect(screen.getByText('Northwind')).toBeTruthy()
    expect(screen.getByText('at risk')).toBeTruthy()
  })

  it('opens the relationship explanation and creates one follow-up task', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Northwind/ }))
    expect(await screen.findByText('Relationship details')).toBeTruthy()
    expect(screen.getAllByText(/Inbound message message-1 is unanswered/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Create follow-up task' }))
    expect(customerRetentionApi.createTask).toHaveBeenCalledWith('rec-1')
  })

  it('filters the list and shows an empty state', async () => {
    vi.mocked(customerRetentionApi.accounts).mockResolvedValue({ data: [], total: 0 })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Insufficient data' }))
    expect(customerRetentionApi.accounts).toHaveBeenCalledWith('insufficient_data')
    expect(await screen.findByText(/No assessed customers/)).toBeTruthy()
  })

  it('hides tenant retention from a member and shows an error state', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Customer retention is limited to managers')).toBeTruthy()
    cleanup()

    auth.role = 'admin'
    vi.mocked(customerRetentionApi.analytics).mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('Retention counts could not be loaded.')).toBeTruthy()
  })
})
