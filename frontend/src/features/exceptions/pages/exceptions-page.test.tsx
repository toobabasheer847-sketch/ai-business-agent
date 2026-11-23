import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exceptionsApi } from '@/features/exceptions/api/exceptions.api'
import { ExceptionsPage } from '@/features/exceptions/pages/exceptions-page'
import { usersApi } from '@/features/users/api/users.api'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/exceptions/api/exceptions.api', () => ({
  exceptionsApi: {
    summary: vi.fn(),
    attention: vi.fn(),
    list: vi.fn(),
    find: vi.fn(),
    detect: vi.fn(),
    acknowledge: vi.fn(),
    assign: vi.fn(),
    status: vi.fn(),
    resolve: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/features/users/api/users.api', () => ({
  usersApi: { list: vi.fn() },
}))

const summary = vi.mocked(exceptionsApi.summary)
const list = vi.mocked(exceptionsApi.list)
const find = vi.mocked(exceptionsApi.find)
const acknowledge = vi.mocked(exceptionsApi.acknowledge)
const assign = vi.mocked(exceptionsApi.assign)
const resolve = vi.mocked(exceptionsApi.resolve)
const dismiss = vi.mocked(exceptionsApi.dismiss)
const users = vi.mocked(usersApi.list)

const row = {
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
  occurrenceCount: 2,
  priorityScore: 90,
  priorityReason: 'Priority 90 because this is Critical severity, not yet acknowledged.',
  recommendedAction: 'Review the task and update the due date or complete it.',
  recommendedActionType: 'review_task',
  assignedTo: null,
  acknowledgedAt: null,
  resolvedAt: null,
  dismissedAt: null,
  resolutionNote: null,
  metadata: { rule: 'overdue' },
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExceptionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ExceptionsPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.clearAllMocks()
    summary.mockResolvedValue({ open: 1, critical: 1, high: 0, acknowledged: 0, resolved: 0, resolvedToday: 0, categories: { task: 1 }, insight: 'Suggestion, not a verified forecast: 1 open exception, including 1 critical and 0 high.', insightSource: 'rule' })
    list.mockResolvedValue({ data: [row], total: 1 })
    find.mockResolvedValue({ ...row, evidence: row.description, suggestion: row.recommendedAction, suggestionSource: 'rule' })
    users.mockResolvedValue([{ id: 'user-1', tenantId: 'tenant-1', name: 'Grace', email: 'grace@example.com', isActive: true, createdAt: '', updatedAt: '' }])
    acknowledge.mockResolvedValue(row)
    assign.mockResolvedValue(row)
    resolve.mockResolvedValue(row)
    dismiss.mockResolvedValue(row)
  })

  afterEach(() => cleanup())

  it('renders the exception list', async () => {
    renderPage()
    expect(await screen.findByText('Task needs attention: Invoice')).toBeTruthy()
    expect(screen.getByText('This task is overdue by 4 days and is still pending.')).toBeTruthy()
    expect(screen.getByText('Next: Review the task and update the due date or complete it.')).toBeTruthy()
    expect(screen.getByText('90')).toBeTruthy()
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0)
  })

  it('filters and paginates through the API', async () => {
    list.mockResolvedValue({ data: [row], total: 40 })
    renderPage()
    await screen.findByText('Task needs attention: Invoice')
    await userEvent.click(screen.getByRole('button', { name: 'High' }))
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ severity: 'high', page: 1 }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ severity: 'high', page: 2 }))
  })

  it('shows details and acknowledges, assigns, resolves, and dismisses', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Task needs attention: Invoice'))
    expect(await screen.findByText(/Suggested next action/)).toBeTruthy()
    expect(screen.getByText(/What happened/)).toBeTruthy()
    expect(screen.getByText(/Why it matters/)).toBeTruthy()
    expect(screen.getByText(/not a verified business fact/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    expect(acknowledge).toHaveBeenCalledWith('ex-1', expect.anything())
    await user.selectOptions(screen.getByLabelText('Assign to'), 'user-1')
    await user.click(screen.getByRole('button', { name: 'Assign' }))
    expect(assign).toHaveBeenCalledWith('ex-1', 'user-1')
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    await user.type(screen.getByLabelText('Resolution note'), 'Called the client')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(resolve).toHaveBeenCalledWith('ex-1', 'Called the client')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await user.type(screen.getByLabelText('Dismissal reason'), 'Not relevant')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(dismiss).toHaveBeenCalledWith('ex-1', 'Not relevant')
  }, 20000)

  it('shows a loading skeleton and an error retry', async () => {
    let release: (value: { data: typeof row[]; total: number }) => void = () => undefined
    list.mockImplementation(() => new Promise((resolvePromise) => { release = resolvePromise }))
    const { unmount } = renderPage()
    expect(await screen.findByTestId('exceptions-loading')).toBeTruthy()
    release({ data: [], total: 0 })
    unmount()
    list.mockRejectedValue(new Error('offline'))
    renderPage()
    expect(await screen.findByText('Exceptions could not be loaded')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows an empty state when detection found nothing', async () => {
    list.mockResolvedValue({ data: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No exceptions')).toBeTruthy()
  })

  it('hides management actions from roles without audit access', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Exception Center is limited to managers')).toBeTruthy()
    expect(list).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull()
  })
})
