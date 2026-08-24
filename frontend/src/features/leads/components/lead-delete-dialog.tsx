import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Lead } from '@/features/leads/types/lead.types'

type LeadDeleteDialogProps = {
  lead: Lead | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function fullName(lead: Lead | null) {
  if (!lead) return ''
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ')
}

export function LeadDeleteDialog({
  lead,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: LeadDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete lead</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes <strong>{fullName(lead)}</strong>.
            </span>
            <span className="block">
              Deleting a lead may also remove related Prospects because the
              backend cascades deletes to associated prospects.
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
