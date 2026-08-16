import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-zinc-200 bg-zinc-50 text-zinc-700',
      )}
    >
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  )
}
