import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Proposal } from '@/features/proposals/types/proposal.types'

type ProposalDeleteDialogProps = {
  proposal: Proposal | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ProposalDeleteDialog({
  proposal,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: ProposalDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete proposal</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes{' '}
              <strong>{proposal?.title ?? 'this proposal'}</strong>.
            </span>
            <span className="block">
              Only this proposal record is deleted. No other CRM records are
              removed by this action.
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
