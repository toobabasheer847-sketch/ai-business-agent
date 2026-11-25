import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicCustomerChatPage } from '@/features/customer-facing/pages/public-customer-chat-page'

const api = vi.hoisted(() => ({
  getPublicCustomerChat: vi.fn(),
  startPublicCustomerChat: vi.fn(),
  getPublicCustomerHistory: vi.fn(),
  sendPublicCustomerMessage: vi.fn(),
  submitPublicCustomerDetails: vi.fn(),
  requestPublicCustomerHandoff: vi.fn(),
  endPublicCustomerChat: vi.fn(),
}))

vi.mock('@/features/customer-facing/api/public-customer-chat.api', () => api)

const config = {
  displayName: 'Northwind Assistant',
  welcomeMessage: 'Hello. I can answer from published information.',
  enabled: true,
  collectName: true,
  collectEmail: true,
  collectPhone: false,
  accent: 'blue' as const,
  disclosure: 'You are talking with an AI assistant.',
  privacyNotice: 'Messages are stored for this business.',
  starters: ['What services do you offer?'],
}

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/chat/public-key']}>
      <Routes>
        <Route path="/chat/:publicKey" element={<PublicCustomerChatPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('public customer chat', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('shows a loading state, then the welcome and AI disclosure', async () => {
    api.getPublicCustomerChat.mockReturnValue(new Promise(() => undefined))
    renderChat()
    expect(screen.getByText('Loading chat…')).toBeTruthy()
  })

  it('starts a conversation, sends a message, saves details, and shows a handoff', async () => {
    api.getPublicCustomerChat.mockResolvedValue(config)
    api.startPublicCustomerChat.mockResolvedValue({ ...config, sessionToken: 'token', expiresInDays: 7 })
    api.sendPublicCustomerMessage.mockResolvedValue({ reply: 'Published hours are weekdays.', handoff: false, handoffNote: null, unanswered: false })
    api.submitPublicCustomerDetails.mockResolvedValue({ saved: true, leadCreated: false, leadLinked: false, reason: 'A name was not provided.' })
    api.requestPublicCustomerHandoff.mockResolvedValue({ handoff: true, handoffNote: 'A person has not replied in this chat yet.' })
    api.getPublicCustomerHistory.mockResolvedValue({ messages: [], status: 'handoff', handoff: true, handoffNote: 'A person has not replied in this chat yet.', disclosure: config.disclosure })
    const user = userEvent.setup()
    renderChat()
    expect(await screen.findByRole('heading', { name: 'Northwind Assistant' })).toBeTruthy()
    expect(screen.getByText('You are talking with an AI assistant.')).toBeTruthy()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Start conversation' }))
    await user.click(await screen.findByRole('button', { name: 'What services do you offer?' }))
    expect(await screen.findByText('Published hours are weekdays.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('A name was not provided.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Talk to a person' }))
    expect(await screen.findByText(/has not replied/i)).toBeTruthy()
  })

  it('shows an error when the chat cannot be loaded', async () => {
    api.getPublicCustomerChat.mockRejectedValue(new Error('This chat is not available.'))
    renderChat()
    expect(await screen.findByRole('heading', { name: 'Chat unavailable' })).toBeTruthy()
    expect(screen.getByText('This chat is not available.')).toBeTruthy()
  })

  it('shows a send error without dropping the conversation', async () => {
    api.getPublicCustomerChat.mockResolvedValue(config)
    api.startPublicCustomerChat.mockResolvedValue({ ...config, sessionToken: 'token', expiresInDays: 7 })
    api.sendPublicCustomerMessage.mockRejectedValue(new Error('The message was not sent.'))
    const user = userEvent.setup()
    renderChat()
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Start conversation' }))
    await user.type(await screen.findByLabelText('Message'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findByRole('alert')).textContent).toContain('The message was not sent.')
  })
})
