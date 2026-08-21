import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Task } from '@/features/tasks/types/task.types'

export type TaskConfirmAction = 'complete' | 'cancel'

type TaskConfirmDialogProps = {
  task: Task | null
  action: TaskConfirmAction | null
  open: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function TaskConfirmDialog({
  task,
  action,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: TaskConfirmDialogProps) {
  const isComplete = action === 'complete'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? 'Mark task completed' : 'Cancel task'}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? `Mark “${task?.title ?? 'this task'}” as completed?`
              : `Are you sure you want to cancel “${task?.title ?? 'this task'}”?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant={isComplete ? 'default' : 'destructive'}
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting
              ? isComplete
                ? 'Completing…'
                : 'Cancelling…'
              : isComplete
                ? 'Mark completed'
                : 'Cancel task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
