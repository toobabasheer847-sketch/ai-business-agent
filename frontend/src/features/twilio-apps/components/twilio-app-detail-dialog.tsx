import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import type { TwilioApp } from '@/features/twilio-apps/types/twilio-app.types'
import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
import {
  TwilioAppStatusBadge,
  maskSecret,
} from '@/features/twilio-apps/components/twilio-app-badges'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TwilioAppDetailDialogProps = {
  open: boolean
  app: TwilioApp | null
  phoneNumber?: PhoneNumber
  onOpenChange: (open: boolean) => void
  onEdit: (app: TwilioApp) => void
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  )
}

export function TwilioAppDetailDialog({
  open,
  app,
  phoneNumber,
  onOpenChange,
  onEdit,
}: TwilioAppDetailDialogProps) {
  const [revealToken, setRevealToken] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRevealToken(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Twilio App details</DialogTitle>
          <DialogDescription>
            Credentials are tenant-scoped. Auth Token stays masked by default.
          </DialogDescription>
        </DialogHeader>

        {app && (
          <dl>
            <DetailRow
              label="Phone number"
              value={
                phoneNumber
                  ? `${phoneNumber.phoneNumber}${phoneNumber.label ? ` (${phoneNumber.label})` : ''}`
                  : app.phoneNumberId
              }
            />
            <DetailRow
              label="Status"
              value={<TwilioAppStatusBadge status={app.status} />}
            />
            <DetailRow
              label="Account SID"
              value={<span className="font-mono text-xs">{app.accountSid}</span>}
            />
            <DetailRow
              label="Auth Token"
              value={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {revealToken ? app.authToken : maskSecret(app.authToken)}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setRevealToken((v) => !v)}
                    aria-label={
                      revealToken ? 'Hide auth token' : 'Show auth token'
                    }
                  >
                    {revealToken ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              }
            />
            <DetailRow
              label="App SID"
              value={
                <span className="font-mono text-xs">{app.appSid || '—'}</span>
              }
            />
            <DetailRow label="Webhook URL" value={app.webhookUrl || '—'} />
            <DetailRow label="Created" value={formatDate(app.createdAt)} />
            <DetailRow label="Updated" value={formatDate(app.updatedAt)} />
          </dl>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {app && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onEdit(app)
              }}
            >
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
