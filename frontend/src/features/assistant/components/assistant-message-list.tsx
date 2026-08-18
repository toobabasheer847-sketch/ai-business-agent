import type { RefObject } from 'react'
import { Bot } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AssistantMarkdown } from '@/features/assistant/components/assistant-markdown'
import { cn } from '@/lib/utils'
import {
  DELEGATION_LABELS,
  type AssistantMessage,
} from '@/features/assistant/types/assistant.types'

type AssistantMessageListProps = {
  messages: AssistantMessage[]
  bottomRef: RefObject<HTMLDivElement | null>
}

export function AssistantMessageList({
  messages,
  bottomRef,
}: AssistantMessageListProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === 'user'
  const delegation =
    !isUser && message.delegation
      ? DELEGATION_LABELS[message.delegation]
      : null

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[min(100%,42rem)] space-y-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="size-3.5" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Assistant
            </span>
            {delegation && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {delegation}
              </Badge>
            )}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words',
            isUser && 'whitespace-pre-wrap',
            isUser
              ? 'bg-primary text-primary-foreground'
              : message.error
                ? 'border border-destructive/30 bg-destructive/5 text-destructive whitespace-pre-wrap'
                : 'border bg-muted/60 text-foreground',
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <Skeleton className="size-1.5 rounded-full" />
              <Skeleton className="size-1.5 rounded-full" />
              <Skeleton className="size-1.5 rounded-full" />
              <span className="sr-only">Assistant is thinking</span>
            </div>
          ) : isUser || message.error ? (
            message.content
          ) : (
            <AssistantMarkdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}
