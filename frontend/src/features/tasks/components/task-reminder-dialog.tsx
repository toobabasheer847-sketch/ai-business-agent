import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDisableTaskReminders,
  useEnableTaskReminders,
  useRescheduleTaskReminders,
  useTaskReminders,
} from '@/features/tasks/hooks/use-tasks'
import type { Task, TaskReminderItem } from '@/features/tasks/types/task.types'
import { getErrorMessage } from '@/lib/api'

type TaskReminderDialogProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(status: TaskReminderItem['status']) {
  if (status === 'scheduled' || status === 'processing') return 'Scheduled'
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'disabled' || status === 'cancelled') return 'Disabled'
  return status
}

export function TaskReminderDialog({
  task,
  open,
  onOpenChange,
}: TaskReminderDialogProps) {
  const query = useTaskReminders(task?.id, open && Boolean(task?.id))
  const enableMutation = useEnableTaskReminders()
  const disableMutation = useDisableTaskReminders()
  const rescheduleMutation = useRescheduleTaskReminders()
  const [scheduledAt, setScheduledAt] = useState('')
  const reminders = query.data?.reminders ?? []
  const pending =
    enableMutation.isPending ||
    disableMutation.isPending ||
    rescheduleMutation.isPending

  async function handleEnable() {
    if (!task || pending) return
    try {
      await enableMutation.mutateAsync(task.id)
      toast.success('Reminders enabled')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDisable() {
    if (!task || pending) return
    try {
      await disableMutation.mutateAsync(task.id)
      toast.success('Reminders disabled')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleReschedule() {
    if (!task || pending) return
    const value = scheduledAt.trim()
    if (!value) {
      toast.error('Choose a reminder date and time')
      return
    }
    try {
      await rescheduleMutation.mutateAsync({
        taskId: task.id,
        scheduledAt: new Date(value).toISOString(),
      })
      toast.success('Reminder rescheduled')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task reminders</DialogTitle>
          <DialogDescription>
            {task
              ? `Reminder controls for “${task.title}”.`
              : 'Reminder controls for this task.'}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load reminders</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{getErrorMessage(query.error)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reminder has been scheduled for this task yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {item.type === 'before_due' ? 'Before due' : 'Overdue'}
                  </span>
                  <span className="text-muted-foreground">{statusLabel(item.status)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Scheduled {formatWhen(item.scheduledAt)}
                  {item.channel ? ` · ${item.channel}` : ''}
                  {item.sentAt ? ` · sent ${formatWhen(item.sentAt)}` : ''}
                  {item.failedAt ? ` · failed ${formatWhen(item.failedAt)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2">
          <Label htmlFor="reminder-scheduled-at">Reschedule at</Label>
          <Input
            id="reminder-scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || !task}
            onClick={() => void handleEnable()}
          >
            Enable reminder
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !task}
            onClick={() => void handleReschedule()}
          >
            Reschedule
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !task}
            onClick={() => void handleDisable()}
          >
            Disable reminder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
