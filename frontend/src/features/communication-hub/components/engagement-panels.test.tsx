import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { engagementApi } from '@/features/communication-hub/api/communication-hub.api'
import { EngagementPanels } from '@/features/communication-hub/components/engagement-panels'

const auth = vi.hoisted(() => ({ role: 'admin' as string }))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Ada', tenantId: 'tenant-1', role: auth.role }, isBootstrapping: false }),
}))

vi.mock('@/features/communication-hub/api/communication-hub.api', () => ({
  engagementApi: {
    send: vi.fn(),
    draft: vi.fn(),
    templates: vi.fn(),
    saveTemplate: vi.fn(),
    campaigns: vi.fn(),
    startCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
    savePreference: vi.fn(),
    analytics: vi.fn(),
    whatsapp: vi.fn(),
    saveWhatsapp: vi.fn(),
  },
}))

function renderPanel(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe('engagement panels', () => {
  beforeEach(() => {
    auth.role = 'admin'
    vi.mocked(engagementApi.templates).mockResolvedValue([])
    vi.mocked(engagementApi.campaigns).mockResolvedValue([
      { id: 'campaign-1', name: 'April note', status: 'draft', channel: 'email', purpose: 'customer_requested', approvalId: null, counts: [] },
    ])
    vi.mocked(engagementApi.analytics).mockResolvedValue({
      sent: 2,
      delivered: 0,
      read: 0,
      failed: 1,
      pending: 0,
      queued: 0,
      inbound: 1,
      outbound: 3,
      handoffs: 1,
      note: 'Sent means the provider accepted the message.',
      responseTime: { sampleSize: 0, medianMinutes: null, insufficient: true },
    })
    vi.mocked(engagementApi.whatsapp).mockResolvedValue({ liveIntegration: 'unverified', status: 'not_configured', configured: false })
    vi.mocked(engagementApi.draft).mockResolvedValue({
      body: 'Hello Ada,\n\nThis draft was prepared by AI and is not a sent message.',
      subject: 'Follow-up',
      authorKind: 'ai',
      source: 'rules',
      channelReason: 'No stored channel preference was found, so this does not assume consent.',
      modelUsed: false,
    })
    vi.mocked(engagementApi.send).mockResolvedValue({ status: 'pending_approval' })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('drafts an AI message and submits it for approval', async () => {
    const user = userEvent.setup()
    renderPanel(<EngagementPanels />)
    await user.type(screen.getByLabelText('Recipient'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Draft with AI' }))
    expect(await screen.findByText('AI draft')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(engagementApi.send).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'email',
      to: 'ada@example.com',
      authorKind: 'ai',
    }))
  })

  it('shows campaign status and asks before cancelling', async () => {
    const user = userEvent.setup()
    renderPanel(<EngagementPanels />)
    await user.click(screen.getByRole('button', { name: 'campaigns' }))
    expect(await screen.findByText('April note')).toBeTruthy()
    expect(screen.getByText('draft')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Confirm cancel' }))
    expect(engagementApi.cancelCampaign).toHaveBeenCalledWith('campaign-1')
  })

  it('does not present sent messages as delivered', async () => {
    const user = userEvent.setup()
    renderPanel(<EngagementPanels />)
    await user.click(screen.getByRole('button', { name: 'analytics' }))
    expect(await screen.findByText(/Sent 2 · Delivered 0/)).toBeTruthy()
    expect(screen.getByText(/Response time is not shown/)).toBeTruthy()
  })

  it('hides sending controls from a member', async () => {
    auth.role = 'member'
    renderPanel(<EngagementPanels />)
    expect(await screen.findByText(/require communication access/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toHaveProperty('disabled', true)
  })
})
