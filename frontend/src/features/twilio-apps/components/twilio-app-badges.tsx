import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  inactive: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
}

export function TwilioAppStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', statusStyles[status] ?? 'text-foreground')}
    >
      {status}
    </Badge>
  )
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 4) return '••••••••'
  return `••••••••••••${value.slice(-4)}`
}

export function truncateSid(value: string | null | undefined, keep = 8): string {
  if (!value) return '—'
  if (value.length <= keep + 4) return value
  return `${value.slice(0, keep)}…`
}
