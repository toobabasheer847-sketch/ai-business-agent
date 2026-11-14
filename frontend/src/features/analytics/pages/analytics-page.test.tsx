import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { analyticsApi } from '@/features/analytics/api/analytics.api'
import { AnalyticsPage } from '@/features/analytics/pages/analytics-page'

vi.mock('@/features/analytics/api/analytics.api', () => ({
  analyticsApi: {
    sales: vi.fn(),
    proposals: vi.fn(),
    tasks: vi.fn(),
    team: vi.fn(),
    communications: vi.fn(),
    trends: vi.fn(),
    insights: vi.fn(),
  },
}))

const sales = vi.mocked(analyticsApi.sales)
const proposals = vi.mocked(analyticsApi.proposals)
const tasks = vi.mocked(analyticsApi.tasks)
const team = vi.mocked(analyticsApi.team)
const communications = vi.mocked(analyticsApi.communications)
const trends = vi.mocked(analyticsApi.trends)
const insights = vi.mocked(analyticsApi.insights)

const comparison = {
  current: 4,
  previous: 2,
  difference: 2,
  percentChange: 100,
  direction: 'up' as const,
}

function renderPage(className = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <div className={className}>
        <AnalyticsPage />
      </div>
    </QueryClientProvider>,
  )
}

describe('AnalyticsPage', () => {
  afterEach(() => cleanup())

  it('renders KPI values, comparison, insights, and chart points from the API', async () => {
    sales.mockResolvedValue({
      window: { preset: '30d', from: '2026-10-15T00:00:00.000Z', to: '2026-11-14T00:00:00.000Z', timezone: 'UTC' },
      previousWindow: null,
      pipeline: { companies: 4, leads: 7, prospects: 3, proposals: 2 },
      comparisons: { companies: comparison, leads: comparison, prospects: comparison, proposals: comparison },
      leadToProspect: { numerator: 1, denominator: 4, percent: 25, definition: 'fk' },
      leadStatus: [{ status: 'new', count: 7 }],
      prospectStatus: [],
      note: 'Pipeline counts are records created in the period.',
    })
    proposals.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      currentStatusEvents: { draft: 1, generated: 0, sent: 2, viewed: 1, accepted: 1, rejected: 0, expired: 0, cancelled: 0 },
      comparisons: { sent: comparison, accepted: comparison, rejected: comparison },
      acceptanceRate: { numerator: 1, denominator: 2, percent: 50, definition: 'sent' },
      rejectionRate: { numerator: 0, denominator: 2, percent: 0, definition: 'sent' },
      averageSentToAcceptedHours: 12,
      note: 'Drafts are excluded.',
    })
    tasks.mockResolvedValue({
      status: { pending: 5, inProgress: 1, completed: 2, cancelled: 0, overdue: 1 },
      completionRate: { numerator: 2, denominator: 8, percent: 25, definition: 'snapshot' },
      comparisons: { completed: comparison, overdue: comparison },
      note: 'Cancelled tasks are excluded.',
    })
    team.mockResolvedValue({
      members: [{ employeeId: '1', name: 'Sarah', pending: 5, inProgress: 1, completed: 2, overdue: 1, open: 6 }],
      upcomingDeadlines: [],
      note: 'not a productivity score',
    })
    communications.mockResolvedValue({
      conversations: { totalConversations: 3, emailConversations: 2, smsConversations: 0, callConversations: 1, webConversations: 0 },
      comparisons: { total: comparison },
      status: [],
      note: 'Counts are conversations by channel, not emails sent.',
    })
    trends.mockResolvedValue({
      leads: [{ day: '2026-11-14', count: 2 }],
      proposals: [],
      tasksCreated: [],
      tasksCompleted: [],
      note: 'UTC day',
    })
    insights.mockResolvedValue({
      insights: [{
        insightId: 'leads-up',
        category: 'sales',
        title: 'Lead creation increased',
        description: 'Lead creation increased: 7 in the current period and 2 in the previous period (100%).',
        supportingMetric: 'leadsCreated',
        currentValue: 7,
        previousValue: 2,
        trend: 'up',
        severity: 'info',
        recommendation: 'Review the new leads.',
        evidencePeriod: '30d',
        kind: 'fact',
      }],
    })

    renderPage()
    expect(await screen.findByText('Lead creation increased')).toBeTruthy()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByText('Sarah: 6 open, 2 completed, 1 overdue.')).toBeTruthy()
    expect(screen.getByText('2026-11-14')).toBeTruthy()
    expect(screen.getByText(/Counts are conversations by channel/)).toBeTruthy()
    expect(document.querySelector('[data-testid="analytics-kpis"]')?.className).toContain('lg:grid-cols-4')
  })

  it('shows an empty state when the period has no CRM records or tasks', async () => {
    sales.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      previousWindow: null,
      pipeline: { companies: 0, leads: 0, prospects: 0, proposals: 0 },
      comparisons: { companies: comparison, leads: comparison, prospects: comparison, proposals: comparison },
      leadToProspect: { numerator: 0, denominator: 0, percent: null, definition: 'fk' },
      leadStatus: [],
      prospectStatus: [],
      note: 'none',
    })
    proposals.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      currentStatusEvents: { draft: 0, generated: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 },
      comparisons: { sent: comparison, accepted: comparison, rejected: comparison },
      acceptanceRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      rejectionRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      averageSentToAcceptedHours: null,
      note: 'none',
    })
    tasks.mockResolvedValue({
      status: { pending: 0, inProgress: 0, completed: 0, cancelled: 0, overdue: 0 },
      completionRate: { numerator: 0, denominator: 0, percent: null, definition: 'snapshot' },
      comparisons: { completed: comparison, overdue: comparison },
      note: 'none',
    })
    team.mockResolvedValue({ members: [], upcomingDeadlines: [], note: 'none' })
    communications.mockResolvedValue({
      conversations: { totalConversations: 0, emailConversations: 0, smsConversations: 0, callConversations: 0, webConversations: 0 },
      comparisons: { total: comparison },
      status: [],
      note: 'none',
    })
    trends.mockResolvedValue({ leads: [], proposals: [], tasksCreated: [], tasksCompleted: [], note: 'none' })
    insights.mockResolvedValue({ insights: [] })

    renderPage()
    expect(await screen.findByText('No records were created in this period.')).toBeTruthy()
    expect(screen.getByText('No insight was calculated for this period.')).toBeTruthy()
  })

  it('shows an error and retries the sales request', async () => {
    sales.mockRejectedValue(new Error('offline'))
    proposals.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      currentStatusEvents: { draft: 0, generated: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 },
      comparisons: { sent: comparison, accepted: comparison, rejected: comparison },
      acceptanceRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      rejectionRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      averageSentToAcceptedHours: null,
      note: 'none',
    })
    tasks.mockResolvedValue({
      status: { pending: 0, inProgress: 0, completed: 0, cancelled: 0, overdue: 0 },
      completionRate: { numerator: 0, denominator: 0, percent: null, definition: 'snapshot' },
      comparisons: { completed: comparison, overdue: comparison },
      note: 'none',
    })
    team.mockResolvedValue({ members: [], upcomingDeadlines: [], note: 'none' })
    communications.mockResolvedValue({
      conversations: { totalConversations: 0, emailConversations: 0, smsConversations: 0, callConversations: 0, webConversations: 0 },
      comparisons: { total: comparison },
      status: [],
      note: 'none',
    })
    trends.mockResolvedValue({ leads: [], proposals: [], tasksCreated: [], tasksCompleted: [], note: 'none' })
    insights.mockResolvedValue({ insights: [] })

    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('button', { name: /Retry/ }, { timeout: 4000 })).toBeTruthy()
    sales.mockResolvedValue({
      window: { preset: '30d', from: null, to: null, timezone: 'UTC' },
      previousWindow: null,
      pipeline: { companies: 1, leads: 0, prospects: 0, proposals: 0 },
      comparisons: { companies: comparison, leads: comparison, prospects: comparison, proposals: comparison },
      leadToProspect: { numerator: 0, denominator: 0, percent: null, definition: 'fk' },
      leadStatus: [],
      prospectStatus: [],
      note: 'recovered',
    })
    await user.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByText('recovered')).toBeTruthy()
  })

  it('changes the date filter and keeps labels in a dark wrapper', async () => {
    sales.mockResolvedValue({
      window: { preset: '7d', from: null, to: null, timezone: 'UTC' },
      previousWindow: null,
      pipeline: { companies: 1, leads: 1, prospects: 0, proposals: 0 },
      comparisons: { companies: comparison, leads: comparison, prospects: comparison, proposals: comparison },
      leadToProspect: { numerator: 0, denominator: 1, percent: 0, definition: 'fk' },
      leadStatus: [],
      prospectStatus: [],
      note: 'Pipeline counts are records created in the period.',
    })
    proposals.mockResolvedValue({
      window: { preset: '7d', from: null, to: null, timezone: 'UTC' },
      currentStatusEvents: { draft: 0, generated: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 },
      comparisons: { sent: comparison, accepted: comparison, rejected: comparison },
      acceptanceRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      rejectionRate: { numerator: 0, denominator: 0, percent: null, definition: 'sent' },
      averageSentToAcceptedHours: null,
      note: 'none',
    })
    tasks.mockResolvedValue({
      status: { pending: 1, inProgress: 0, completed: 0, cancelled: 0, overdue: 0 },
      completionRate: { numerator: 0, denominator: 1, percent: 0, definition: 'snapshot' },
      comparisons: { completed: comparison, overdue: comparison },
      note: 'none',
    })
    team.mockResolvedValue({ members: [], upcomingDeadlines: [], note: 'none' })
    communications.mockResolvedValue({
      conversations: { totalConversations: 0, emailConversations: 0, smsConversations: 0, callConversations: 0, webConversations: 0 },
      comparisons: { total: comparison },
      status: [],
      note: 'none',
    })
    trends.mockResolvedValue({ leads: [], proposals: [], tasksCreated: [], tasksCompleted: [], note: 'none' })
    insights.mockResolvedValue({ insights: [] })

    const user = userEvent.setup()
    renderPage('dark')
    expect(await screen.findByRole('button', { name: 'Last 30 days' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(sales).toHaveBeenCalledWith({ range: '7d' })
    expect(document.querySelector('.dark')).toBeTruthy()
    expect(screen.getByText('New leads')).toBeTruthy()
  })
})
