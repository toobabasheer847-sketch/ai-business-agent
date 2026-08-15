import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  sent: 'border-sky-200 bg-sky-50 text-sky-800',
  viewed: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  expired: 'border-amber-200 bg-amber-50 text-amber-800',
  cancelled: 'border-zinc-200 bg-zinc-50 text-zinc-700',
}

export function ProposalStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', statusStyles[status] ?? 'text-foreground')}
    >
      {status}
    </Badge>
  )
}
