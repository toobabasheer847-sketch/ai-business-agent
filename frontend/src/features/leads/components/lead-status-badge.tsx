import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  new: 'border-sky-200 bg-sky-50 text-sky-800',
  contacted: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  qualified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  unqualified: 'border-slate-200 bg-slate-50 text-slate-700',
  converted: 'border-teal-200 bg-teal-50 text-teal-800',
  lost: 'border-red-200 bg-red-50 text-red-800',
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', statusStyles[status] ?? 'text-foreground')}
    >
      {status}
    </Badge>
  )
}
