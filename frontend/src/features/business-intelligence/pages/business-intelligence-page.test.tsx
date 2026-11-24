import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { businessIntelligenceApi } from '@/features/business-intelligence/api/business-intelligence.api'
import { BusinessIntelligencePage } from '@/features/business-intelligence/pages/business-intelligence-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/business-intelligence/api/business-intelligence.api', () => ({
  businessIntelligenceApi: {
    overview: vi.fn(),
    salesForecast: vi.fn(),
    leadInsights: vi.fn(),
    revenuePipeline: vi.fn(),
    workloadForecast: vi.fn(),
    risks: vi.fn(),
    insights: vi.fn(),
    refresh: vi.fn(),
  },
}))

const overview = vi.mocked(businessIntelligenceApi.overview)
const sales = vi.mocked(businessIntelligenceApi.salesForecast)
const leads = vi.mocked(businessIntelligenceApi.leadInsights)
const pipeline = vi.mocked(businessIntelligenceApi.revenuePipeline)
const workload = vi.mocked(businessIntelligenceApi.workloadForecast)
const risks = vi.mocked(businessIntelligenceApi.risks)
const insights = vi.mocked(businessIntelligenceApi.insights)
const refresh = vi.mocked(businessIntelligenceApi.refresh)

const forecast = {
  metric: 'lead_volume',
  status: 'forecast' as const,
  method: 'weekly_moving_average',
  horizonDays: 7,
  predicted: 4,
  lower: 2,
  upper: 6,
  confidence: 'MEDIUM',
  weeks: 8,
  observations: 32,
  warnings: [],
  holdout: { predicted: 4, actual: 3, absoluteError: 1, percentageError: 33.3 },
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BusinessIntelligencePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BusinessIntelligencePage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.clearAllMocks()
    overview.mockResolvedValue({
      window: { preset: '30d', timezone: 'UTC' },
      horizonDays: 7,
      history: {
        leadsCreated: 12,
        previousLeads: 9,
        prospectsCreated: 4,
        companiesCreated: 2,
        acceptance: { decided: 10, rate: 40 },
        conversion: { explanation: '4 of 6 leads are converted.', conversionRate: 66.7, individualProbabilities: false },
      },
      pipeline: [{ currency: 'USD', accepted: '100.00', pending: '50.00', rejected: '10.00', acceptedCount: 1, pendingCount: 1, rejectedCount: 1, missingPrice: 0, forecastPotential: null, forecastStatus: 'INSUFFICIENT_DATA', label: 'Not revenue' }],
      workload: { open: 5, overdue: 2, dueNext7Days: 3 },
      risks: [{ title: 'Several tasks are overdue now' }],
      forecasts: [forecast],
      classification: { facts: 'Stored rows.', forecasts: 'Estimates.', revenue: 'Not revenue.' },
    })
    sales.mockResolvedValue({ forecasts: [forecast, { ...forecast, metric: 'accepted_value', status: 'INSUFFICIENT_DATA', predicted: null, lower: null, upper: null, method: null, confidence: 'INSUFFICIENT_DATA', warnings: ['More than one currency.'] }] })
    leads.mockResolvedValue({
      conversion: { created: 12, converted: 4, lost: 2, open: 6, terminal: 6, conversionRate: 66.7, individualProbabilities: false, explanation: '4 of 6 leads created in this period now have a converted or lost status and are converted.', pattern: null },
    })
    pipeline.mockResolvedValue({
      pipeline: [{ currency: 'USD', accepted: '100.00', pending: '50.00', rejected: '10.00', acceptedCount: 1, pendingCount: 1, rejectedCount: 1, missingPrice: 1, forecastPotential: null, forecastStatus: 'INSUFFICIENT_DATA', label: 'Not revenue' }],
      note: 'Currencies are not combined.',
    })
    workload.mockResolvedValue({
      workload: { open: 5, overdue: 2, dueNext7Days: 3, note: 'Assigned task counts are workload, not productivity.', completionForecast: 'INSUFFICIENT_DATA', busiest: null, users: [{ userId: 'u1', name: 'Ada', open: 3, overdue: 1 }], averageCompletionMs: null },
    })
    risks.mockResolvedValue({
      risks: [{ key: 'overdue_tasks', severity: 'high', title: 'Several tasks are overdue now', evidence: '2 open tasks have a due time before now.', comparison: 'Past overdue counts are not stored.', action: 'Review the overdue task list.', confidence: 'HIGH', predictive: false }],
    })
    insights.mockResolvedValue({
      insights: [{ key: 'deadline_cluster', category: 'operations', severity: 'medium', title: 'Task deadlines are concentrated', description: '3 tasks', evidence: '3 open tasks are due within seven days.', confidence: 'HIGH', recommendation: 'Review the due list.', suggestion: true }],
      note: 'Saved copies are written by refresh.',
    })
    refresh.mockResolvedValue({ savedForecasts: 1, savedInsights: 1, evaluated: 0 })
  })

  afterEach(() => cleanup())

  it('shows historical facts, a forecast range, and the revenue boundary', async () => {
    renderPage()
    expect(await screen.findByText('12')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('USD 100.00')).toBeTruthy()
    expect(screen.getByText('Not recognized revenue')).toBeTruthy()
    expect(await screen.findByText('Estimate 4 (range 2 to 6)')).toBeTruthy()
    expect(screen.getByText('INSUFFICIENT_DATA')).toBeTruthy()
    expect(screen.getByText('Currencies are not combined.')).toBeTruthy()
    expect(screen.getByText('Individual lead probabilities are not shown.')).toBeTruthy()
    expect(screen.getByText('Assigned task counts are workload, not productivity.')).toBeTruthy()
    expect(screen.getByText('Several tasks are overdue now')).toBeTruthy()
    expect(screen.getByText('Suggestion: Review the due list.')).toBeTruthy()
  })

  it('does not load tenant intelligence for a member', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Business intelligence is limited to managers')).toBeTruthy()
    expect(overview).not.toHaveBeenCalled()
  })

  it('retries after an overview error', async () => {
    overview.mockRejectedValueOnce(new Error('down'))
    renderPage()
    expect(await screen.findByText('Business intelligence could not be loaded')).toBeTruthy()
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('40%')).toBeTruthy()
  })

  it('asks for a custom range before loading', async () => {
    renderPage()
    await screen.findByText('40%')
    await userEvent.setup({ delay: null }).selectOptions(screen.getByLabelText('Period'), 'custom')
    expect(screen.getByLabelText('From')).toBeTruthy()
    expect(screen.getByLabelText('To')).toBeTruthy()
  })
})
