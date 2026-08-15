import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Conversation } from '@/features/conversations/types/conversation.types'

type ConversationDeleteDialogProps = {
  conversation: Conversation | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function conversationTitle(conversation: Conversation | null) {
  if (!conversation) return ''
  return conversation.title?.trim() || 'Untitled conversation'
}

export function ConversationDeleteDialog({
  conversation,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: ConversationDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete conversation</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes{' '}
              <strong>{conversationTitle(conversation)}</strong>.
            </span>
            <span className="block">
              Deleting a conversation will also delete its messages because the
              backend cascades deletes to associated messages.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
