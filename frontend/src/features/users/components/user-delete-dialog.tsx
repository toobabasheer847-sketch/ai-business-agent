import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { User } from '@/features/users/types/user.types'

type UserDeleteDialogProps = {
  user: User | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function UserDeleteDialog({
  user,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: UserDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This permanently removes{' '}
              <strong>{user?.name ?? 'this user'}</strong> ({user?.email}).
            </span>
            <span className="block">
              Only this user account is deleted. You cannot delete your own
              account.
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
