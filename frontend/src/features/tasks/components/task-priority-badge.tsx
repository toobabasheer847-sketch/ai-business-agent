import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const priorityStyles: Record<string, string> = {
  low: 'border-slate-200 bg-slate-50 text-slate-700',
  medium: 'border-sky-200 bg-sky-50 text-sky-800',
  high: 'border-amber-200 bg-amber-50 text-amber-800',
  urgent: 'border-red-200 bg-red-50 text-red-800',
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', priorityStyles[priority] ?? 'text-foreground')}
    >
      {priority}
    </Badge>
  )
}
