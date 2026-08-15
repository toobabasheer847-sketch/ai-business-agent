import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  archived: 'border-slate-200 bg-slate-50 text-slate-700',
  closed: 'border-red-200 bg-red-50 text-red-800',
}

export function ConversationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', statusStyles[status] ?? 'text-foreground')}
    >
      {status}
    </Badge>
  )
}
