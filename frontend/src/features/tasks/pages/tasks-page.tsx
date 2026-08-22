import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, BarChart3, ListTodo, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api'
import { DeleteTaskDialog } from '@/features/tasks/components/delete-task-dialog'
import { TaskConfirmDialog } from '@/features/tasks/components/task-confirm-dialog'
import { TaskFilters } from '@/features/tasks/components/task-filters'
import { TaskForm } from '@/features/tasks/components/task-form'
import { TasksTable } from '@/features/tasks/components/tasks-table'
import { TaskActivityDialog } from '@/features/tasks/components/task-activity-dialog'
import { TaskReminderDialog } from '@/features/tasks/components/task-reminder-dialog'
import {
  useCancelTask,
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks/use-tasks'
import type {
  CreateTaskFormValues,
  UpdateTaskFormValues,
} from '@/features/tasks/schemas/task.schemas'
import type {
  CreateTaskRequest,
  Task,
  TaskListQuery,
  TaskPriority,
  TaskStatus,
  UpdateTaskRequest,
} from '@/features/tasks/types/task.types'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useLeads } from '@/features/leads/hooks/use-leads'
import { useProspects } from '@/features/prospects/hooks/use-prospects'
import { useUsers } from '@/features/users/hooks/use-users'

function TableSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-5/6" />
    </div>
  )
}

function toIsoDateString(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function utcDayBounds(offsetDays: number) {
  const now = new Date()
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + offsetDays,
  )
  return {
    dueFrom: new Date(start).toISOString(),
    dueTo: new Date(start + 24 * 60 * 60 * 1000 - 1).toISOString(),
  }
}

function dueWindowQuery(
  dueWindow: '' | 'overdue' | 'today' | 'tomorrow' | 'upcoming',
): Pick<TaskListQuery, 'overdue' | 'dueFrom' | 'dueTo' | 'openOnly'> {
  if (dueWindow === 'overdue') return { overdue: true }
  if (dueWindow === 'today') return utcDayBounds(0)
  if (dueWindow === 'tomorrow') return utcDayBounds(1)
  if (dueWindow === 'upcoming') {
    return { dueFrom: new Date().toISOString(), openOnly: true }
  }
  return {}
}

function toCreatePayload(values: CreateTaskFormValues): CreateTaskRequest {
  const payload: CreateTaskRequest = {
    title: values.title.trim(),
  }

  const description = values.description?.trim()
  if (description) payload.description = description
  if (values.priority) payload.priority = values.priority
  if (values.assignedTo) payload.assignedTo = values.assignedTo
  if (values.companyId) payload.companyId = values.companyId
  if (values.prospectId) payload.prospectId = values.prospectId
  if (values.leadId) payload.leadId = values.leadId

  const dueAt = toIsoDateString(values.dueAt)
  if (dueAt) payload.dueAt = dueAt

  return payload
}

function toUpdatePayload(values: UpdateTaskFormValues): UpdateTaskRequest {
  const payload: UpdateTaskRequest = {
    title: values.title.trim(),
  }

  payload.description = values.description?.trim() ?? ''
  if (values.status) payload.status = values.status
  if (values.priority) payload.priority = values.priority
  if (values.assignedTo) payload.assignedTo = values.assignedTo
  payload.companyId = values.companyId?.trim() ? values.companyId : null
  payload.prospectId = values.prospectId?.trim() ? values.prospectId : null
  payload.leadId = values.leadId?.trim() ? values.leadId : null

  const dueAt = toIsoDateString(values.dueAt)
  if (dueAt) payload.dueAt = dueAt

  return payload
}

function taskErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (!(error instanceof ApiError)) return message

  if (error.status === 400) return message
  if (error.status === 401) return 'You need to sign in again to manage tasks.'
  if (error.status === 403) {
    return 'You do not have access to this task.'
  }
  if (error.status === 404) {
    return /task not found/i.test(message) ? message : 'Task not found'
  }

  return message
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [companyId, setCompanyId] = useState(searchParams.get('companyId') ?? '')
  const [prospectId, setProspectId] = useState(
    searchParams.get('prospectId') ?? '',
  )
  const [leadId, setLeadId] = useState(searchParams.get('leadId') ?? '')
  const [dueWindow, setDueWindow] = useState<
    '' | 'overdue' | 'today' | 'tomorrow' | 'upcoming'
  >('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [activityTask, setActivityTask] = useState<Task | null>(null)
  const [reminderTask, setReminderTask] = useState<Task | null>(null)
  const [confirming, setConfirming] = useState<{
    task: Task
    action: 'complete' | 'cancel'
  } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setCompanyId(searchParams.get('companyId') ?? '')
    setProspectId(searchParams.get('prospectId') ?? '')
    setLeadId(searchParams.get('leadId') ?? '')
  }, [searchParams])

  function setCrmParam(
    key: 'companyId' | 'prospectId' | 'leadId',
    value: string,
  ) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const listQueryInput = useMemo<TaskListQuery | undefined>(() => {
    const query: TaskListQuery = {
      search: debouncedSearch.trim() || undefined,
      status: (status as TaskStatus) || undefined,
      priority: (priority as TaskPriority) || undefined,
      companyId: companyId || undefined,
      prospectId: prospectId || undefined,
      leadId: leadId || undefined,
      ...dueWindowQuery(dueWindow),
    }
    if (
      !query.search &&
      !query.status &&
      !query.priority &&
      !query.companyId &&
      !query.prospectId &&
      !query.leadId &&
      !query.overdue &&
      !query.dueFrom &&
      !query.dueTo &&
      !query.openOnly
    ) {
      return undefined
    }
    return query
  }, [debouncedSearch, status, priority, companyId, prospectId, leadId, dueWindow])

  const usersQuery = useUsers()
  const companiesQuery = useCompanies()
  const leadsQuery = useLeads()
  const prospectsQuery = useProspects()
  const listQuery = useTasks(listQueryInput)
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const completeMutation = useCompleteTask()
  const cancelMutation = useCancelTask()
  const deleteMutation = useDeleteTask()

  const users = usersQuery.data ?? []
  const companies = companiesQuery.data ?? []
  const leads = leadsQuery.data ?? []
  const prospects = prospectsQuery.data ?? []
  const items = listQuery.data ?? []

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of users) {
      map.set(user.id, user.name || user.email)
    }
    return map
  }, [users])

  const hasFilters = Boolean(
    search || status || priority || companyId || prospectId || leadId,
  )

  async function handleCreate(
    values: CreateTaskFormValues | UpdateTaskFormValues,
  ) {
    try {
      await createMutation.mutateAsync(
        toCreatePayload(values as CreateTaskFormValues),
      )
      toast.success('Task created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(taskErrorMessage(error))
    }
  }

  async function handleUpdate(
    values: CreateTaskFormValues | UpdateTaskFormValues,
  ) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values as UpdateTaskFormValues),
      })
      toast.success('Task updated')
      setEditing(null)
    } catch (error) {
      toast.error(taskErrorMessage(error))
    }
  }

  async function handleConfirmAction() {
    if (!confirming) return
    try {
      if (confirming.action === 'complete') {
        await completeMutation.mutateAsync(confirming.task.id)
        toast.success('Task marked as completed')
      } else {
        await cancelMutation.mutateAsync(confirming.task.id)
        toast.success('Task cancelled')
      }
      setConfirming(null)
    } catch (error) {
      toast.error(taskErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Task deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(taskErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="View and manage tasks assigned to you or created by you. Tenant and owner come from your session — they are never sent from this page."
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <Link to="/tasks/analytics">
                <BarChart3 className="size-4" />
                Analytics
              </Link>
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/assistant">
                <Bot className="size-4" />
                Ask AI to create a task
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw
                className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Task
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <TaskFilters
          search={search}
          status={status}
          priority={priority}
          dueWindow={dueWindow}
          companyId={companyId}
          prospectId={prospectId}
          leadId={leadId}
          companies={companies}
          prospects={prospects}
          leads={leads}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onDueWindowChange={setDueWindow}
          onCompanyChange={(value) => setCrmParam('companyId', value)}
          onProspectChange={(value) => setCrmParam('prospectId', value)}
          onLeadChange={(value) => setCrmParam('leadId', value)}
          onReset={() => {
            setSearch('')
            setStatus('')
            setPriority('')
            setDueWindow('')
            setDebouncedSearch('')
            setSearchParams({}, { replace: true })
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load tasks</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{taskErrorMessage(listQuery.error)}</span>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <ListTodo className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No tasks yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? 'No tasks match your search or filters. Try adjusting them.'
              : 'Create your first task'}
          </p>
          {!hasFilters && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Create your first task
            </Button>
          )}
        </motion.div>
      ) : (
        <TasksTable
          items={items}
          userNameById={userNameById}
          onEdit={setEditing}
          onComplete={(task) => setConfirming({ task, action: 'complete' })}
          onCancel={(task) => setConfirming({ task, action: 'cancel' })}
          onDelete={setDeleting}
          onViewActivity={setActivityTask}
          onManageReminders={setReminderTask}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Creates a task via <code>POST /api/ai/task</code>. Ownership is
              taken from your JWT session.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            mode="create"
            users={users}
            companies={companies}
            leads={leads}
            prospects={prospects}
            submitLabel="Create"
            submitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Updates via <code>POST /api/ai/task/:taskId</code>.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <TaskForm
              key={editing.id}
              mode="edit"
              initial={editing}
              users={users}
              companies={companies}
              leads={leads}
              prospects={prospects}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <TaskConfirmDialog
        task={confirming?.task ?? null}
        action={confirming?.action ?? null}
        open={Boolean(confirming)}
        submitting={completeMutation.isPending || cancelMutation.isPending}
        onOpenChange={(open) => !open && setConfirming(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      <DeleteTaskDialog
        task={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />

      <TaskActivityDialog
        task={activityTask}
        open={Boolean(activityTask)}
        onOpenChange={(open) => !open && setActivityTask(null)}
      />

      <TaskReminderDialog
        task={reminderTask}
        open={Boolean(reminderTask)}
        onOpenChange={(open) => !open && setReminderTask(null)}
      />
    </div>
  )
}
