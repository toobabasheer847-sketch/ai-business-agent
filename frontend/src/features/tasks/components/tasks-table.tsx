import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskPriorityBadge } from '@/features/tasks/components/task-priority-badge'
import { TaskStatusBadge } from '@/features/tasks/components/task-status-badge'
import type { Task } from '@/features/tasks/types/task.types'

type TasksTableProps = {
  items: Task[]
  userNameById: Map<string, string>
  onEdit: (item: Task) => void
  onComplete: (item: Task) => void
  onCancel: (item: Task) => void
  onDelete: (item: Task) => void
  onViewActivity: (item: Task) => void
  onManageReminders: (item: Task) => void
  onManageDependencies: (item: Task) => void
}

function crmHasLinks(item: Task) {
  return Boolean(item.company?.id || item.prospect?.id || item.lead?.id)
}

function crmLinkClass() {
  return 'text-foreground underline-offset-4 hover:underline'
}

function CrmLinks({ item }: { item: Task }) {
  const parts: ReactNode[] = []

  if (item.company?.id && item.company.name) {
    parts.push(
      <span key="company">
        Company:{' '}
        <Link
          to={`/tasks?companyId=${item.company.id}`}
          className={crmLinkClass()}
        >
          {item.company.name}
        </Link>
      </span>,
    )
  }

  if (item.prospect?.id && item.prospect.name) {
    parts.push(
      <span key="prospect">
        Prospect:{' '}
        <Link
          to={`/tasks?prospectId=${item.prospect.id}`}
          className={crmLinkClass()}
        >
          {item.prospect.name}
        </Link>
      </span>,
    )
  }

  if (item.lead?.id) {
    const leadLabel = item.lead.email || item.lead.name
    if (leadLabel) {
      parts.push(
        <span key="lead">
          Lead:{' '}
          <Link to={`/tasks?leadId=${item.lead.id}`} className={crmLinkClass()}>
            {leadLabel}
          </Link>
        </span>,
      )
    }
  }

  if (parts.length === 0) return <>{'\u2014'}</>

  return (
    <div className="flex flex-col gap-0.5">
      {parts.map((part, index) => (
        <div key={index}>{part}</div>
      ))}
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function reminderLabel(item: Task) {
  const status = item.reminder?.status
  if (!status) return 'No reminder'
  if (status === 'pending' || status === 'processing') return 'Scheduled'
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'disabled' || status === 'cancelled' || status === 'skipped') {
    return 'Disabled'
  }
  return 'No reminder'
}

function DueCell({ item }: { item: Task }) {
  return (
    <div className="space-y-0.5">
      <div className={item.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
        {formatDateTime(item.dueAt)}
      </div>
      {item.isOverdue ? (
        <div className="text-xs font-medium text-destructive">Overdue</div>
      ) : null}
    </div>
  )
}

export function TasksTable({
  items,
  userNameById,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
  onViewActivity,
  onManageReminders,
  onManageDependencies,
}: TasksTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-x-auto rounded-xl border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Due</TableHead>
            <TableHead className="hidden md:table-cell">Reminder</TableHead>
            <TableHead className="hidden md:table-cell">Assigned</TableHead>
            <TableHead className="hidden lg:table-cell">CRM</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="w-[72px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const assignedName = item.assignedTo
              ? userNameById.get(item.assignedTo)
              : undefined
            const canComplete =
              item.status !== 'completed' && item.status !== 'cancelled'
            const canCancel = item.status !== 'cancelled'

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.title}</div>
                  {item.description ? (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  ) : null}
                  {item.isBlocked ? (
                    <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Blocked by dependency
                    </div>
                  ) : null}
                  {item.recurrenceEnabled ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Recurs {item.recurrenceInterval || 'on schedule'}
                    </div>
                  ) : null}
                  {crmHasLinks(item) ? (
                    <div className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                      <CrmLinks item={item} />
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs sm:hidden">
                    <DueCell item={item} />
                  </div>
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={item.priority} />
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <DueCell item={item} />
                </TableCell>
                <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                  {reminderLabel(item)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {assignedName || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  <CrmLinks item={item} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDateTime(item.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Actions for ${item.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewActivity(item)}>
                        View activity
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageReminders(item)}>
                        View reminder details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageDependencies(item)}>
                        Manage dependencies
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageReminders(item)}>
                        Enable reminder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageReminders(item)}>
                        Disable reminder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageReminders(item)}>
                        Reschedule reminder
                      </DropdownMenuItem>
                      {canComplete ? (
                        <DropdownMenuItem onClick={() => onComplete(item)}>
                          Mark completed
                        </DropdownMenuItem>
                      ) : null}
                      {canCancel ? (
                        <DropdownMenuItem onClick={() => onCancel(item)}>
                          Cancel task
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(item)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </motion.div>
  )
}
