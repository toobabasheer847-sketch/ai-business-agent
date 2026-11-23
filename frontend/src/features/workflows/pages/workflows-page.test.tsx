import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { workflowsApi } from '@/features/workflows/api/workflows.api'
import { WorkflowsPage } from '@/features/workflows/pages/workflows-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/workflows/api/workflows.api', () => ({
  workflowsApi: {
    summary: vi.fn(),
    list: vi.fn(),
    generate: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    execute: vi.fn(),
    executions: vi.fn(),
    execution: vi.fn(),
    cancel: vi.fn(),
  },
}))

const summary = vi.mocked(workflowsApi.summary)
const list = vi.mocked(workflowsApi.list)
const generate = vi.mocked(workflowsApi.generate)
const create = vi.mocked(workflowsApi.create)
const find = vi.mocked(workflowsApi.find)
const activate = vi.mocked(workflowsApi.activate)
const pause = vi.mocked(workflowsApi.pause)
const execute = vi.mocked(workflowsApi.execute)
const executions = vi.mocked(workflowsApi.executions)

const definition = {
  schemaVersion: 1 as const,
  trigger: { type: 'new_lead' },
  conditions: [],
  actions: [{ key: 'task', type: 'create_task', input: { title: 'Follow up with the new lead' } }],
  settings: { maxRetries: 2, timeoutMs: 30000 },
}

const record = {
  id: 'wf-1',
  name: 'New lead follow-up',
  description: 'Suggested from the instruction. It is not active.',
  status: 'draft',
  triggerType: 'new_lead',
  definition,
  version: 1,
  createdBy: 'user-1',
  activatedAt: null,
  pausedAt: null,
  createdAt: '2026-11-16T12:00:00.000Z',
  updatedAt: '2026-11-16T12:00:00.000Z',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkflowsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WorkflowsPage', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.clearAllMocks()
    summary.mockResolvedValue({
      total: 1,
      active: 0,
      paused: 0,
      draft: 1,
      completed: 1,
      failed: 0,
      waiting: 0,
      recentFailures: [],
    })
    list.mockResolvedValue({ data: [record], total: 1 })
    find.mockResolvedValue(record)
    executions.mockResolvedValue({
      data: [{
        id: 'run-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        triggerSource: 'manual',
        triggerReference: 'manual:1',
        status: 'completed',
        startedAt: '2026-11-16T12:00:00.000Z',
        completedAt: '2026-11-16T12:00:01.000Z',
        durationMs: 1000,
        errorCode: null,
        sanitizedError: null,
        steps: [{ id: 'step-1', stepKey: 'task', actionType: 'create_task', status: 'completed', attemptCount: 1, approvalId: null, errorCode: null, sanitizedError: null, outputSnapshot: { taskId: 'task-1', delivered: false } }],
      }],
      total: 1,
    })
    generate.mockResolvedValue({
      proposal: definition,
      valid: true,
      errors: [],
      missing: [],
      unsupported: [],
      source: 'rule',
      summary: 'This suggestion is not an active workflow.',
    })
    create.mockResolvedValue(record)
    activate.mockResolvedValue({ ...record, status: 'active' })
    pause.mockResolvedValue({ ...record, status: 'paused' })
    execute.mockResolvedValue({
      id: 'run-2',
      workflowId: 'wf-1',
      workflowVersion: 1,
      triggerSource: 'manual',
      triggerReference: 'manual:2',
      status: 'completed',
      startedAt: '2026-11-16T12:00:00.000Z',
      completedAt: '2026-11-16T12:00:01.000Z',
      durationMs: 20,
      errorCode: null,
      sanitizedError: null,
    })
  })

  afterEach(() => cleanup())

  it('shows live workflow counts', async () => {
    renderPage()
    expect(await screen.findByText('Workflows')).toBeTruthy()
    expect(await screen.findByText('Successful runs')).toBeTruthy()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(summary).toHaveBeenCalled()
  })

  it('reviews a generated suggestion and saves it as a draft', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await screen.findByText('Saved workflows')
    await user.type(screen.getByLabelText('Workflow instruction'), 'When a new lead is created, create a follow-up task.')
    await user.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText('This suggestion is not an active workflow.')).toBeTruthy()
    expect(screen.getByText(/Source: rule suggestion/)).toBeTruthy()
    await user.clear(screen.getByLabelText('Workflow name'))
    await user.type(screen.getByLabelText('Workflow name'), 'New lead follow-up')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New lead follow-up', definition }))
  }, 20000)

  it('shows validation problems from generation', async () => {
    generate.mockResolvedValue({
      proposal: null,
      valid: false,
      errors: ['The recipient is missing.'],
      missing: ['email recipient'],
      unsupported: ['shell command'],
      source: 'rule',
      summary: 'The instruction cannot be saved yet.',
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await screen.findByLabelText('Workflow instruction')
    await user.type(screen.getByLabelText('Workflow instruction'), 'Send an email to the customer now.')
    await user.click(screen.getByRole('button', { name: 'Generate' }))
    expect(await screen.findByText(/Missing: email recipient/)).toBeTruthy()
    expect(screen.getByText(/Unsupported: shell command/)).toBeTruthy()
  }, 20000)

  it('activates, pauses, and runs a workflow', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(activate).toHaveBeenCalledWith('wf-1', expect.anything())
    list.mockResolvedValue({ data: [{ ...record, status: 'active' }], total: 1 })
    cleanup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(pause).toHaveBeenCalledWith('wf-1', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Run now' }))
    expect(execute).toHaveBeenCalledWith('wf-1', expect.anything())
  })

  it('shows execution steps', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: /New lead follow-up/ }))
    expect(await screen.findByText(/create_task: completed/)).toBeTruthy()
  })

  it('hides management from a member and does not call the API', async () => {
    auth.role = 'member'
    renderPage()
    expect(await screen.findByText('Workflows are limited to managers')).toBeTruthy()
    expect(summary).not.toHaveBeenCalled()
  })

  it('shows an error state', async () => {
    summary.mockRejectedValue(new Error('down'))
    list.mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('Workflow summary is unavailable')).toBeTruthy()
    expect(await screen.findByText('Workflows could not be loaded')).toBeTruthy()
  })

  it('shows an empty state', async () => {
    list.mockResolvedValue({ data: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No workflows')).toBeTruthy()
  })
})
