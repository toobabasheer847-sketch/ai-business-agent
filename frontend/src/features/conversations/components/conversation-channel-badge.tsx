import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const channelStyles: Record<string, string> = {
  web: 'border-sky-200 bg-sky-50 text-sky-800',
  email: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  sms: 'border-amber-200 bg-amber-50 text-amber-800',
  call: 'border-violet-200 bg-violet-50 text-violet-800',
}

export function ConversationChannelBadge({ channel }: { channel: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('uppercase', channelStyles[channel] ?? 'text-foreground')}
    >
      {channel}
    </Badge>
  )
}
