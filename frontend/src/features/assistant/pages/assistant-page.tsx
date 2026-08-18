import { useEffect, useId, useRef, useState } from 'react'
import { Bot } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { AssistantComposer } from '@/features/assistant/components/assistant-composer'
import { AssistantMessageList } from '@/features/assistant/components/assistant-message-list'
import { useSendAssistantMessage } from '@/features/assistant/hooks/use-assistant'
import { getAssistantErrorMessage } from '@/features/assistant/lib/assistant-errors'
import type { AssistantMessage } from '@/features/assistant/types/assistant.types'

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AssistantPage() {
  const sendMessage = useSendAssistantMessage()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  const sending = sendMessage.isPending

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function handleSend() {
    const message = draft.trim()
    if (!message || sending) return

    setError(null)
    setDraft('')

    const userMessage: AssistantMessage = {
      id: createId('user'),
      role: 'user',
      content: message,
      createdAt: Date.now(),
    }
    const pendingId = createId('assistant')
    const pendingMessage: AssistantMessage = {
      id: pendingId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    }

    setMessages((current) => [...current, userMessage, pendingMessage])

    try {
      const result = await sendMessage.mutateAsync(message)
      const content =
        result.response.trim() ||
        'The assistant did not return a response. Please try again.'

      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content,
                pending: false,
                delegation: result.delegation,
              }
            : item,
        ),
      )
    } catch (caught) {
      const friendly = getAssistantErrorMessage(caught)
      setError(friendly)
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                error: true,
                content: friendly,
              }
            : item,
        ),
      )
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-7.5rem)] flex-col">
      <PageHeader
        title="AI Assistant"
        description="Ask questions, create tasks, draft emails, and generate proposals through the Master Agent."
      />

      <Card className="flex min-h-0 flex-1 flex-col py-0">
        {messages.length === 0 ? (
          <EmptyState headingId={headingId} />
        ) : (
          <AssistantMessageList messages={messages} bottomRef={bottomRef} />
        )}

        {error && messages.length === 0 && (
          <div className="px-4 pb-3 md:px-6">
            <Alert variant="destructive">
              <AlertTitle>Could not send message</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <AssistantComposer
          value={draft}
          sending={sending}
          disabled={sending}
          onChange={setDraft}
          onSubmit={() => {
            void handleSend()
          }}
        />
      </Card>
    </div>
  )
}

function EmptyState({ headingId }: { headingId: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      aria-labelledby={headingId}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Bot className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h2 id={headingId} className="text-base font-medium">
          Start a conversation
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Type a message below to begin. Nothing is sent until you submit it.
        </p>
      </div>
    </div>
  )
}
