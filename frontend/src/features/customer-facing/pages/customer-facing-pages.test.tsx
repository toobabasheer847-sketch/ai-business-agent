import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { customerFacingApi } from '@/features/customer-facing/api/customer-facing.api'
import { CustomerAiSettingsPage } from '@/features/customer-facing/pages/customer-ai-settings-page'
import { CustomerConversationsPage } from '@/features/customer-facing/pages/customer-conversations-page'

const auth = vi.hoisted(() => ({ role: 'admin' as string | undefined }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/customer-facing/api/customer-facing.api', () => ({
  customerFacingApi: {
    conversations: vi.fn(),
    conversation: vi.fn(),
    assign: vi.fn(),
    resolve: vi.fn(),
    reopen: vi.fn(),
    note: vi.fn(),
    settings: vi.fn(),
    updateSettings: vi.fn(),
  },
}))

vi.mock('@/features/users/hooks/use-users', () => ({
  useUsers: () => ({ data: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Sam' }] }),
}))

vi.mock('@/features/companies/hooks/use-companies', () => ({
  useCompanies: () => ({ data: [{ id: 'company-1', name: 'Northwind' }] }),
}))

vi.mock('@/features/knowledgebases/hooks/use-knowledgebases', () => ({
  useKnowledgebases: () => ({ data: [{ id: 'kb-1', name: 'Published docs' }] }),
}))

const conversation = {
  conversationId: 'conversation-1',
  status: 'handoff',
  intent: 'human_assistance',
  confidence: 'HIGH',
  visitorName: 'Ada Lovelace',
  visitorEmail: 'ada@example.com',
  leadId: 'lead-1',
  handoffAt: '2026-11-26T00:00:00.000Z',
  summary: 'Purpose: The visitor asked for a person.',
  updatedAt: '2026-11-26T00:00:00.000Z',
  title: 'Customer chat',
}

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('customer conversation management', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.mocked(customerFacingApi.conversations).mockResolvedValue({ data: [conversation] })
    vi.mocked(customerFacingApi.conversation).mockResolvedValue({
      ...conversation,
      id: 'state-1',
      intentEvidence: 'The visitor asked to speak with a person.',
      intentSource: 'visitor',
      handoffReason: 'The visitor asked for a person.',
      visitorPhone: null,
      requirements: 'Weekday onboarding',
      assignedUserId: null,
      messages: [{ id: 'message-1', role: 'human', content: 'I want to talk to a person.', createdAt: '2026-11-26T00:00:00.000Z' }],
    })
    vi.mocked(customerFacingApi.resolve).mockResolvedValue({ status: 'resolved' })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('filters the inbox and resolves a handoff', async () => {
    const user = userEvent.setup()
    renderPage(<CustomerConversationsPage />)
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Human help requested')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }))
    expect(await screen.findByText(/Weekday onboarding/)).toBeTruthy()
    expect(screen.getByText(/Linked lead/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(customerFacingApi.resolve).toHaveBeenCalledWith('conversation-1')
  })

  it('hides the inbox from a role without communication access', async () => {
    auth.role = 'guest'
    renderPage(<CustomerConversationsPage />)
    expect(await screen.findByText(/do not have permission to view customer conversations/i)).toBeTruthy()
    expect(customerFacingApi.conversations).not.toHaveBeenCalled()
  })
})

describe('customer AI settings', () => {
  beforeEach(() => {
    auth.role = 'owner'
    vi.mocked(customerFacingApi.settings).mockResolvedValue({
      publicKey: 'public-key',
      enabled: false,
      displayName: 'Assistant',
      welcomeMessage: 'Hello',
      instructions: 'Be brief.',
      leadCaptureEnabled: false,
      handoffNotificationsEnabled: true,
      knowledgeBaseId: null,
      companyId: null,
      collectName: true,
      collectEmail: true,
      collectPhone: false,
      accent: 'slate',
    })
    vi.mocked(customerFacingApi.updateSettings).mockResolvedValue({
      publicKey: 'public-key',
      enabled: true,
      displayName: 'Assistant',
      welcomeMessage: 'Hello',
      instructions: 'Be brief.',
      leadCaptureEnabled: true,
      handoffNotificationsEnabled: true,
      knowledgeBaseId: 'kb-1',
      companyId: 'company-1',
      collectName: true,
      collectEmail: true,
      collectPhone: false,
      accent: 'slate',
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('saves tenant settings for an owner', async () => {
    const user = userEvent.setup()
    renderPage(<CustomerAiSettingsPage />)
    expect((await screen.findByLabelText('Display name') as HTMLInputElement).value).toBe('Assistant')
    await user.click(screen.getByRole('checkbox', { name: 'Enable customer-facing AI' }))
    await user.click(screen.getByRole('checkbox', { name: /Create leads/ }))
    await user.selectOptions(screen.getByLabelText('Knowledge base'), 'kb-1')
    await user.selectOptions(screen.getByLabelText('Company'), 'company-1')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(customerFacingApi.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, leadCaptureEnabled: true, knowledgeBaseId: 'kb-1', companyId: 'company-1' }))
    expect(await screen.findByText('Settings saved.')).toBeTruthy()
  })

  it('hides settings from a member', async () => {
    auth.role = 'member'
    renderPage(<CustomerAiSettingsPage />)
    expect(await screen.findByText(/do not have permission to change customer AI settings/i)).toBeTruthy()
    expect(customerFacingApi.settings).not.toHaveBeenCalled()
  })
})
