import { API_URL } from '@/lib/constants/app'

export type PublicProposalSection = {
  heading: string
  body: string
}

export type PublicProposalView = {
  title: string
  description: string | null
  requirements: string | null
  content: string | null
  sections: PublicProposalSection[]
  price: string | null
  currency: string
  validUntil: string | null
  status: string
  viewedAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  pdfAvailable: boolean
  linkExpiresAt: string
  brand: {
    name: string | null
    logoUrl: string | null
    domain: string | null
    phone: string | null
  }
  companyName: string | null
}

export class PublicProposalRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PublicProposalRequestError'
    this.status = status
  }
}

function proposalUrl(token: string, suffix = ''): string {
  return `${API_URL}/public/proposals/${encodeURIComponent(token)}${suffix}`
}

async function readError(response: Response): Promise<PublicProposalRequestError> {
  let message = 'The proposal could not be loaded.'
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message
    } else if (Array.isArray(body.message) && body.message.length > 0) {
      message = body.message.join(' ')
    }
  } catch {
    message = response.statusText || message
  }
  return new PublicProposalRequestError(response.status, message)
}

export async function getPublicProposal(token: string): Promise<PublicProposalView> {
  const response = await fetch(proposalUrl(token), {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await readError(response)
  }
  return (await response.json()) as PublicProposalView
}

export async function acceptPublicProposal(token: string): Promise<PublicProposalView> {
  const response = await fetch(proposalUrl(token, '/accept'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await readError(response)
  }
  return (await response.json()) as PublicProposalView
}

export async function rejectPublicProposal(
  token: string,
  reason: string,
): Promise<PublicProposalView> {
  const response = await fetch(proposalUrl(token, '/reject'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  })
  if (!response.ok) {
    throw await readError(response)
  }
  return (await response.json()) as PublicProposalView
}

export async function downloadPublicProposalPdf(token: string, filename: string): Promise<void> {
  const response = await fetch(proposalUrl(token, '/pdf'), {
    headers: { Accept: 'application/pdf' },
  })
  if (!response.ok) {
    throw await readError(response)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
