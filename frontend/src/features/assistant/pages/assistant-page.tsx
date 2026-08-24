import { useEffect, useId, useRef, useState } from 'react'
import { Bot } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AssistantComposer } from '@/features/assistant/components/assistant-composer'
import { AssistantMessageList } from '@/features/assistant/components/assistant-message-list'
import {
  useAssistantMessages,
  useSendAssistantMessage,
} from '@/features/assistant/hooks/use-assistant'
import { getAssistantErrorMessage } from '@/features/assistant/lib/assistant-errors'
import {
  ASSISTANT_CONVERSATION_STORAGE_KEY,
  isConversationId,
  type AssistantMessage,
} from '@/features/assistant/types/assistant.types'

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readStoredConversationId(): string | null {
  try {
    const value = sessionStorage.getItem(ASSISTANT_CONVERSATION_STORAGE_KEY)
    return isConversationId(value) ? value : null
  } catch {
    return null
  }
}

function writeStoredConversationId(conversationId: string | null) {
  try {
    if (conversationId) {
      sessionStorage.setItem(ASSISTANT_CONVERSATION_STORAGE_KEY, conversationId)
    } else {
      sessionStorage.removeItem(ASSISTANT_CONVERSATION_STORAGE_KEY)
    }
  } catch {
    // sessionStorage may be unavailable in private browsing.
  }
}

export function AssistantPage() {
  const sendMessage = useSendAssistantMessage()
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(() =>
    readStoredConversationId(),
  )
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [hydrated, setHydrated] = useState(!conversationId)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  const historyQuery = useAssistantMessages(conversationId, !hydrated)
  const sending = sendMessage.isPending

  useEffect(() => {
    if (hydrated) {
      return
    }

    if (historyQuery.isSuccess) {
      setMessages(historyQuery.data)
      setHydrated(true)
      return
    }

    if (historyQuery.isError) {
      writeStoredConversationId(null)
      setConversationId(null)
      setMessages([])
      setHydrated(true)
    }
  }, [hydrated, historyQuery.isSuccess, historyQuery.isError, historyQuery.data])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  function rememberConversationId(nextId: string) {
    setConversationId(nextId)
    writeStoredConversationId(nextId)
  }

  function handleNewChat() {
    writeStoredConversationId(null)
    setConversationId(null)
    setMessages([])
    setDraft('')
    setError(null)
    setHydrated(true)
  }

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
      const result = await sendMessage.mutateAsync({
        message,
        conversationId,
      })
      const content =
        result.response.trim() ||
        'The assistant did not return a response. Please try again.'

      if (result.conversationId) {
        rememberConversationId(result.conversationId)
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content,
                pending: false,
                delegation: result.delegation,
                sources: result.sources,
                usedKnowledge: result.usedKnowledge,
                message: result.message,
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
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            disabled={sending}
          >
            New Chat
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col py-0">
        {messages.length === 0 ? (
          <EmptyState headingId={headingId} loading={!hydrated} />
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
          disabled={sending || !hydrated}
          onChange={setDraft}
          onSubmit={() => {
            void handleSend()
          }}
        />
      </Card>
    </div>
  )
}

function EmptyState({
  headingId,
  loading,
}: {
  headingId: string
  loading: boolean
}) {
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
          {loading ? 'Loading conversation' : 'Start a conversation'}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {loading
            ? 'Restoring your previous Assistant messages…'
            : 'Type a message below to begin. Nothing is sent until you submit it.'}
        </p>
      </div>
    </div>
  )
}
