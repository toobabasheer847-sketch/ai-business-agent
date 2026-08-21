import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTaskActivity } from '@/features/tasks/hooks/use-tasks'
import type {
  Task,
  TaskActivityEventType,
  TaskActivityItem,
} from '@/features/tasks/types/task.types'
import { getErrorMessage } from '@/lib/api'

type TaskActivityDialogProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EVENT_LABELS: Record<TaskActivityEventType, string> = {
  TASK_CREATED: 'Created',
  TASK_UPDATED: 'Updated',
  TASK_COMPLETED: 'Completed',
  TASK_CANCELLED: 'Cancelled',
  TASK_REOPENED: 'Reopened',
  TASK_CRM_LINKED: 'CRM linked',
  TASK_CRM_UNLINKED: 'CRM unlinked',
  REMINDER_SCHEDULED: 'Reminder scheduled',
  REMINDER_SENT: 'Reminder sent',
  REMINDER_FAILED: 'Reminder failed',
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeActivity(item: TaskActivityItem): string {
  const metadata = item.metadata ?? {}

  if (item.eventType === 'TASK_UPDATED') {
    const changes = metadata.changes as
      | Record<string, { from?: unknown; to?: unknown }>
      | undefined
    if (!changes) return 'Task updated'
    const parts = Object.entries(changes).map(([field, change]) => {
      if (field === 'priority') {
        return `Priority changed from ${titleCase(String(change.from ?? '—'))} to ${titleCase(String(change.to ?? '—'))}`
      }
      if (field === 'status') {
        return `Status changed from ${titleCase(String(change.from ?? '—'))} to ${titleCase(String(change.to ?? '—'))}`
      }
      if (field === 'dueAt') {
        return 'Due date changed'
      }
      if (field === 'assignedTo') {
        return 'Assignee changed'
      }
      if (field === 'title') {
        return 'Title changed'
      }
      return `${titleCase(field)} updated`
    })
    return parts.join('. ') || 'Task updated'
  }

  if (item.eventType === 'TASK_CRM_LINKED' || item.eventType === 'TASK_CRM_UNLINKED') {
    const type = titleCase(String(metadata.type ?? 'CRM'))
    const name = typeof metadata.name === 'string' && metadata.name ? metadata.name : null
    const verb = item.eventType === 'TASK_CRM_LINKED' ? 'linked' : 'unlinked'
    return name ? `${type} ${verb}: ${name}` : `${type} ${verb}`
  }

  if (item.eventType === 'REMINDER_SENT') {
    const channel = String(metadata.channel ?? 'audit')
    return `Reminder sent via ${channel === 'gmail' ? 'Gmail' : 'audit log'}`
  }
  if (item.eventType === 'REMINDER_FAILED') {
    const reason = typeof metadata.reason === 'string' ? metadata.reason : null
    return reason ? `Reminder failed (${reason.replaceAll('_', ' ')})` : 'Reminder failed'
  }
  if (item.eventType === 'REMINDER_SCHEDULED') {
    return 'Reminder scheduled'
  }
  if (item.eventType === 'TASK_CREATED') {
    return 'Task created'
  }
  if (item.eventType === 'TASK_COMPLETED') {
    return 'Task completed'
  }
  if (item.eventType === 'TASK_CANCELLED') {
    return 'Task cancelled'
  }
  if (item.eventType === 'TASK_REOPENED') {
    return 'Task reopened'
  }

  return EVENT_LABELS[item.eventType]
}

export function TaskActivityDialog({
  task,
  open,
  onOpenChange,
}: TaskActivityDialogProps) {
  const query = useTaskActivity(task?.id, open && Boolean(task?.id))
  const activities = query.data?.activities ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task activity</DialogTitle>
          <DialogDescription>
            {task ? `History for “${task.title}”.` : 'History for this task.'}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-5/6" />
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load activity</AlertTitle>
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
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity has been recorded for this task yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {activities.map((item) => (
              <li key={item.id} className="rounded-lg border px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">
                    {EVENT_LABELS[item.eventType] ?? item.eventType}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatWhen(item.createdAt)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {summarizeActivity(item)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.actor?.name || 'System'}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
