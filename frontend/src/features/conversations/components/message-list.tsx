import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import type { Message } from '@/features/conversations/types/conversation.types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type MessageListProps = {
  messages: Message[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onDelete?: (message: Message) => void
  deletingId?: string | null
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

const roleStyles: Record<string, string> = {
  user: 'border-sky-200 bg-sky-50',
  assistant: 'border-emerald-200 bg-emerald-50',
  system: 'border-slate-200 bg-slate-50',
}

export function MessageList({
  messages,
  loading,
  error,
  onRetry,
  onDelete,
  deletingId,
}: MessageListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-5/6" />
        <Skeleton className="h-16 w-4/5" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load messages</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center">
        <p className="text-sm font-medium">No messages yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send the first message to start this thread.
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.02, 0.2) }}
          className={cn(
            'rounded-xl border px-3 py-3',
            roleStyles[message.role] ?? 'bg-background',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium uppercase tracking-wide">
                  {message.role}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(message.createdAt)}
                </span>
                {message.tokenCount != null ? (
                  <span className="text-muted-foreground">
                    {message.tokenCount} tokens
                  </span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
            {onDelete ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={deletingId === message.id}
                onClick={() => onDelete(message)}
                aria-label="Delete message"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
