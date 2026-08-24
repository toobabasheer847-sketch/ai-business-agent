import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Company } from '@/features/companies/types/company.types'

type CompanyDeleteDialogProps = {
  company: Company | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function CompanyDeleteDialog({
  company,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: CompanyDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete company</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes <strong>{company?.name}</strong>.
            </span>
            <span className="block">
              Deleting a company may also remove related Leads because the
              backend cascades deletes to associated leads.
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
