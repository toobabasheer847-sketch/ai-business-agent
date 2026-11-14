import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicProposalPage } from '@/features/public-proposal/pages/public-proposal-page'
import {
  PublicProposalRequestError,
  type PublicProposalView,
} from '@/features/public-proposal/api/public-proposal.api'

vi.mock('@/features/public-proposal/api/public-proposal.api', () => ({
  getPublicProposal: vi.fn(),
  acceptPublicProposal: vi.fn(),
  rejectPublicProposal: vi.fn(),
  downloadPublicProposalPdf: vi.fn(),
  PublicProposalRequestError: class PublicProposalRequestError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import {
  acceptPublicProposal,
  getPublicProposal,
  rejectPublicProposal,
} from '@/features/public-proposal/api/public-proposal.api'

const getProposal = vi.mocked(getPublicProposal)
const acceptProposal = vi.mocked(acceptPublicProposal)
const rejectProposal = vi.mocked(rejectPublicProposal)

function proposal(overrides: Partial<PublicProposalView> = {}): PublicProposalView {
  return {
    title: 'Harbor rollout',
    description: 'Replace the intake desk.',
    requirements: 'Train the front desk.',
    content: null,
    sections: [
      { heading: 'Services', body: 'On-site training' },
      { heading: 'Timeline', body: 'Three weeks' },
      { heading: 'Payment terms', body: 'Half on acceptance' },
    ],
    price: '4800',
    currency: 'USD',
    validUntil: '2026-12-01T00:00:00.000Z',
    status: 'viewed',
    viewedAt: '2026-11-14T00:00:00.000Z',
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    pdfAvailable: true,
    linkExpiresAt: '2026-12-01T00:00:00.000Z',
    brand: {
      name: 'Harbor Studio',
      logoUrl: null,
      domain: 'harbor.example',
      phone: '+15550001',
    },
    companyName: 'Northwind',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/p/public-token']}>
      <Routes>
        <Route path="/p/:token" element={<PublicProposalPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicProposalPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the proposal after it loads', async () => {
    getProposal.mockResolvedValue(proposal())
    renderPage()

    expect(screen.getByText('Loading proposal')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Harbor rollout' })).toBeTruthy()
    expect(screen.getByText('Services')).toBeTruthy()
    expect(screen.getByText('Timeline')).toBeTruthy()
    expect(screen.getByText('Payment terms')).toBeTruthy()
    expect(screen.getByText('Prepared for Northwind')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy()
    expect(screen.getByTestId('proposal-actions').className).toContain('flex-col')
    expect(screen.getByTestId('proposal-actions').className).toContain('sm:flex-row')
  })

  it('shows an expired link without accept or reject actions', async () => {
    getProposal.mockRejectedValue(
      new PublicProposalRequestError(410, 'This proposal link has expired.'),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'This link is no longer available' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('expired')
    expect(screen.queryByRole('button', { name: 'Accept proposal' })).toBeNull()
  })

  it('asks for confirmation before accepting', async () => {
    getProposal.mockResolvedValue(proposal())
    acceptProposal.mockResolvedValue(proposal({ status: 'accepted', acceptedAt: '2026-11-14T01:00:00.000Z' }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Accept proposal' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(acceptProposal).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm acceptance' }))
    expect(await screen.findByText('You accepted this proposal.')).toBeTruthy()
    expect(acceptProposal).toHaveBeenCalledTimes(1)
  })

  it('asks for a reason before rejecting', async () => {
    getProposal.mockResolvedValue(proposal())
    rejectProposal.mockResolvedValue(
      proposal({ status: 'rejected', rejectionReason: 'Budget is frozen.' }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Reject proposal' }))
    const confirm = screen.getByRole('button', { name: 'Confirm rejection' })
    expect(confirm).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox'), 'Budget is frozen.')
    await user.click(confirm)

    expect(await screen.findByText('You rejected this proposal.')).toBeTruthy()
    expect(rejectProposal).toHaveBeenCalledWith('public-token', 'Budget is frozen.')
  })

  it('shows a failed response without clearing the proposal', async () => {
    getProposal.mockResolvedValue(proposal())
    acceptProposal.mockRejectedValue(new PublicProposalRequestError(409, 'This proposal can no longer be accepted.'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Accept proposal' }))
    await user.click(screen.getByRole('button', { name: 'Confirm acceptance' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This proposal can no longer be accepted.')
    expect(screen.getByRole('heading', { name: 'Harbor rollout' })).toBeTruthy()
  })
})
