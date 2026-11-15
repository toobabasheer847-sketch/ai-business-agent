import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  skipped: 'bg-muted text-muted-foreground',
  awaiting_confirmation: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', TONES[status])}>
      {label}
    </Badge>
  )
}
