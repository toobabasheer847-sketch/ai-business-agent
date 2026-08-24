import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Knowledgebase } from '@/features/knowledgebases/types/knowledgebase.types'

type KnowledgebaseDeleteDialogProps = {
  knowledgebase: Knowledgebase | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function KnowledgebaseDeleteDialog({
  knowledgebase,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: KnowledgebaseDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete knowledgebase</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes{' '}
              <strong>{knowledgebase?.name}</strong>.
            </span>
            <span className="block">This action cannot be undone.</span>
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
