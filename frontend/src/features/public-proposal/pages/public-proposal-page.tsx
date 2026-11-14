import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { AssistantMarkdown } from '@/features/assistant/components/assistant-markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  PublicProposalRequestError,
  acceptPublicProposal,
  downloadPublicProposalPdf,
  getPublicProposal,
  rejectPublicProposal,
  type PublicProposalView,
} from '@/features/public-proposal/api/public-proposal.api'

type LoadState = 'loading' | 'ready' | 'missing' | 'expired' | 'error'
type PendingAction = 'accept' | 'reject' | null

function formatDate(value: string | null): string {
  if (!value) return 'Not specified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not specified'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPrice(price: string | null, currency: string): string {
  if (!price) return 'Not specified'
  const amount = Number(price)
  if (!Number.isFinite(amount)) return `${price} ${currency}`
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${price} ${currency}`
  }
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ')
}

export function PublicProposalPage() {
  const { token = '' } = useParams()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('')
  const [proposal, setProposal] = useState<PublicProposalView | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setProposal(null)
    setPending(null)

    getPublicProposal(token)
      .then((view) => {
        if (cancelled) return
        setProposal(view)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const status = error instanceof PublicProposalRequestError ? error.status : 0
        const text = error instanceof Error ? error.message : 'The proposal could not be loaded.'
        setMessage(text)
        if (status === 410) setLoadState('expired')
        else if (status === 404) setLoadState('missing')
        else setLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function confirmAction() {
    if (!pending || submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      const next =
        pending === 'accept'
          ? await acceptPublicProposal(token)
          : await rejectPublicProposal(token, reason.trim())
      setProposal(next)
      setPending(null)
      setReason('')
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'The response was not saved.')
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadPdf() {
    if (!proposal || downloading) return
    setDownloading(true)
    setActionError('')
    try {
      const filename = `${proposal.title.trim() || 'proposal'}.pdf`
      await downloadPublicProposalPdf(token, filename)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'The PDF could not be downloaded.')
    } finally {
      setDownloading(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-4 py-16 sm:px-6">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading proposal
        </p>
      </main>
    )
  }

  if (loadState === 'expired' || loadState === 'missing' || loadState === 'error') {
    const title =
      loadState === 'expired'
        ? 'This link is no longer available'
        : loadState === 'missing'
          ? 'This proposal link was not found'
          : 'The proposal could not be opened'
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-16 sm:px-6">
        <Card className="w-full">
          <CardContent className="space-y-2 py-8">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p role="alert" className="text-sm text-muted-foreground">
              {message}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!proposal) return null

  const closed = proposal.status !== 'sent' && proposal.status !== 'viewed'
  const brandName = proposal.brand.name || proposal.companyName || 'Proposal'
  const initial = brandName.slice(0, 1).toUpperCase()

  return (
    <main className="min-h-svh bg-muted/40">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {proposal.brand.logoUrl ? (
              <img
                src={proposal.brand.logoUrl}
                alt=""
                className="h-12 w-12 rounded-md border bg-background object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-sm font-semibold">
                {initial}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{brandName}</p>
              <p className="text-xs text-muted-foreground">
                {[proposal.brand.domain, proposal.brand.phone].filter(Boolean).join(' · ') ||
                  'Prepared for review'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit capitalize">
            {statusLabel(proposal.status)}
          </Badge>
        </header>

        <Card>
          <CardContent className="space-y-6 py-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {proposal.companyName ? `Prepared for ${proposal.companyName}` : 'Proposal'}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{proposal.title}</h1>
              {proposal.description ? (
                <p className="text-sm leading-6 text-muted-foreground">{proposal.description}</p>
              ) : null}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Pricing</dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatPrice(proposal.price, proposal.currency)}
                </dd>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Proposal expiry</dt>
                <dd className="mt-1 text-sm font-medium">{formatDate(proposal.validUntil)}</dd>
              </div>
            </dl>

            {proposal.requirements ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Requirements</h2>
                <AssistantMarkdown content={proposal.requirements} />
              </section>
            ) : null}

            {proposal.sections.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h2 className="text-sm font-semibold">{section.heading}</h2>
                <AssistantMarkdown content={section.body} />
              </section>
            ))}

            {proposal.rejectionReason ? (
              <p className="text-sm text-muted-foreground">
                Rejection note: {proposal.rejectionReason}
              </p>
            ) : null}

            {proposal.pdfAvailable ? (
              <Button type="button" variant="outline" onClick={() => void downloadPdf()} disabled={downloading}>
                {downloading ? 'Preparing PDF' : 'Download PDF'}
              </Button>
            ) : null}

            {actionError ? (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            ) : null}

            {pending ? (
              <div
                role="alertdialog"
                aria-labelledby="proposal-confirm-title"
                className="space-y-3 rounded-lg border p-4"
              >
                <h2 id="proposal-confirm-title" className="text-sm font-semibold">
                  {pending === 'accept' ? 'Accept this proposal?' : 'Reject this proposal?'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {pending === 'accept'
                    ? 'This records your acceptance. It cannot be changed from this link.'
                    : 'Tell us why this proposal does not work. The note is saved with the decision.'}
                </p>
                {pending === 'reject' ? (
                  <label className="block space-y-1 text-sm">
                    <span>Reason</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={500}
                      rows={4}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant={pending === 'reject' ? 'destructive' : 'default'}
                    disabled={submitting || (pending === 'reject' && reason.trim().length === 0)}
                    onClick={() => void confirmAction()}
                  >
                    {pending === 'accept' ? 'Confirm acceptance' : 'Confirm rejection'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => {
                      setPending(null)
                      setActionError('')
                    }}
                  >
                    Go back
                  </Button>
                </div>
              </div>
            ) : null}

            {!closed && !pending ? (
              <div
                data-testid="proposal-actions"
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Button type="button" onClick={() => setPending('accept')}>
                  Accept proposal
                </Button>
                <Button type="button" variant="outline" onClick={() => setPending('reject')}>
                  Reject proposal
                </Button>
              </div>
            ) : null}

            {proposal.status === 'accepted' ? (
              <p className="text-sm font-medium">You accepted this proposal.</p>
            ) : null}
            {proposal.status === 'rejected' ? (
              <p className="text-sm font-medium">You rejected this proposal.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
