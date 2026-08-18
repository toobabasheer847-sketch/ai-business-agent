import { type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AssistantComposerProps = {
  value: string
  disabled: boolean
  sending: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function AssistantComposer({
  value,
  disabled,
  sending,
  onChange,
  onSubmit,
}: AssistantComposerProps) {
  const canSend = !disabled && !sending && value.trim().length > 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSend) return
    onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t bg-background/80 p-3 md:p-4"
    >
      <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <textarea
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="max-h-40 min-h-10 w-full resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        Enter to send · Shift+Enter for a new line
      </p>
    </form>
  )
}
