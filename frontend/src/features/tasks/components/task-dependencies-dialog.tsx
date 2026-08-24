import { useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAddTaskDependency,
  useRemoveTaskDependency,
  useTaskDependencies,
  useTasks,
} from '@/features/tasks/hooks/use-tasks'
import type { Task } from '@/features/tasks/types/task.types'
import { getErrorMessage } from '@/lib/api'

type TaskDependenciesDialogProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDependenciesDialog({
  task,
  open,
  onOpenChange,
}: TaskDependenciesDialogProps) {
  const depsQuery = useTaskDependencies(task?.id, open && Boolean(task))
  const tasksQuery = useTasks()
  const addDependency = useAddTaskDependency()
  const removeDependency = useRemoveTaskDependency()
  const [dependsOnTaskId, setDependsOnTaskId] = useState('')

  const candidates = useMemo(() => {
    const items = tasksQuery.data ?? []
    const linked = new Set(
      (depsQuery.data?.dependsOn ?? []).map((edge) => edge.dependsOnTaskId),
    )
    return items.filter(
      (item) => item.id !== task?.id && !linked.has(item.id),
    )
  }, [tasksQuery.data, depsQuery.data, task?.id])

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of tasksQuery.data ?? []) {
      map.set(item.id, item.title)
    }
    return map
  }, [tasksQuery.data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dependencies</DialogTitle>
          <DialogDescription>
            {task
              ? `Manage what “${task.title}” waits on, and what waits on it.`
              : 'Manage task dependencies.'}
          </DialogDescription>
        </DialogHeader>

        {!task ? null : depsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : depsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load dependencies</AlertTitle>
            <AlertDescription>{getErrorMessage(depsQuery.error)}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {depsQuery.data?.isBlocked ? (
              <Alert>
                <AlertTitle>Blocked</AlertTitle>
                <AlertDescription>
                  Waiting on:{' '}
                  {(depsQuery.data.blockedBy ?? [])
                    .map((item) => item.title)
                    .join(', ') || 'incomplete dependencies'}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">Depends on</div>
              {(depsQuery.data?.dependsOn ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No prerequisites.</p>
              ) : (
                <ul className="space-y-2">
                  {(depsQuery.data?.dependsOn ?? []).map((edge) => (
                    <li
                      key={edge.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>
                        {titleById.get(edge.dependsOnTaskId) || edge.dependsOnTaskId}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={removeDependency.isPending}
                        onClick={() => {
                          void removeDependency
                            .mutateAsync({
                              taskId: task.id,
                              dependsOnTaskId: edge.dependsOnTaskId,
                            })
                            .then(() => toast.success('Dependency removed'))
                            .catch((error) =>
                              toast.error(getErrorMessage(error)),
                            )
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Dependent tasks</div>
              {(depsQuery.data?.dependents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing currently depends on this task.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {(depsQuery.data?.dependents ?? []).map((edge) => (
                    <li key={edge.id}>
                      {titleById.get(edge.taskId) || edge.taskId}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={dependsOnTaskId || 'none'}
                onValueChange={(value) =>
                  setDependsOnTaskId(value === 'none' ? '' : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add prerequisite…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a task…</SelectItem>
                  {candidates.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                disabled={!dependsOnTaskId || addDependency.isPending}
                onClick={() => {
                  void addDependency
                    .mutateAsync({
                      taskId: task.id,
                      dependsOnTaskId,
                    })
                    .then(() => {
                      setDependsOnTaskId('')
                      toast.success('Dependency added')
                    })
                    .catch((error) => toast.error(getErrorMessage(error)))
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
