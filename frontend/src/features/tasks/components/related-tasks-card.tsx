import { Link } from 'react-router-dom'
import { ListTodo, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskPriorityBadge } from '@/features/tasks/components/task-priority-badge'
import { TaskStatusBadge } from '@/features/tasks/components/task-status-badge'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import type { TaskListQuery } from '@/features/tasks/types/task.types'
import { useUsers } from '@/features/users/hooks/use-users'
import { getErrorMessage } from '@/lib/api'

type RelatedTasksCardProps = {
  companyId?: string
  prospectId?: string
  leadId?: string
  entityLabel: string
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function tasksPath(query: TaskListQuery) {
  const params = new URLSearchParams()
  if (query.companyId) params.set('companyId', query.companyId)
  if (query.prospectId) params.set('prospectId', query.prospectId)
  if (query.leadId) params.set('leadId', query.leadId)
  const search = params.toString()
  return search ? `/tasks?${search}` : '/tasks'
}

export function RelatedTasksCard({
  companyId,
  prospectId,
  leadId,
  entityLabel,
}: RelatedTasksCardProps) {
  const query: TaskListQuery = {
    companyId: companyId || undefined,
    prospectId: prospectId || undefined,
    leadId: leadId || undefined,
  }
  const listQuery = useTasks(query)
  const usersQuery = useUsers()
  const items = listQuery.data ?? []
  const users = usersQuery.data ?? []
  const userNameById = new Map(
    users.map((user) => [user.id, user.name || user.email]),
  )

  return (
    <Card className="border bg-transparent ring-foreground/10">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Your tasks linked to {entityLabel}. Ownership still comes from your
            session.
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
            aria-label="Refresh related tasks"
          >
            <RefreshCw
              className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to={tasksPath(query)}>Open in Tasks</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {listQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
          </div>
        ) : listQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load tasks</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{getErrorMessage(listQuery.error)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
            <ListTodo className="mb-2 size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tasks linked to this {entityLabel.toLowerCase()} yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="space-y-1 px-3 py-2.5">
                <div className="font-medium">{item.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TaskStatusBadge status={item.status} />
                  <TaskPriorityBadge priority={item.priority} />
                  <span>Due {formatDate(item.dueAt)}</span>
                  <span>
                    {item.assignedTo
                      ? userNameById.get(item.assignedTo) || 'Assigned'
                      : 'Unassigned'}
                  </span>
                  <span>Created {formatDate(item.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
