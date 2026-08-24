import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Prospect } from '@/features/prospects/types/prospect.types'

type ProspectDeleteDialogProps = {
  prospect: Prospect | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function fullName(prospect: Prospect | null) {
  if (!prospect) return ''
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

export function ProspectDeleteDialog({
  prospect,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: ProspectDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete prospect</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes <strong>{fullName(prospect)}</strong>.
            </span>
            <span className="block">
              Deleting a prospect may also delete related Proposals because the
              backend cascades deletes to associated proposals.
            </span>
            <span className="block">
              Related Conversations are not deleted; their prospect link is
              cleared (prospectId becomes null).
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
