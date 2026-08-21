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
}

function crmLabel(item: Task) {
  const parts: string[] = []
  if (item.company?.name) parts.push(`Company · ${item.company.name}`)
  if (item.prospect?.name) parts.push(`Prospect · ${item.prospect.name}`)
  if (item.lead?.name) parts.push(`Lead · ${item.lead.name}`)
  return parts.length > 0 ? parts.join(' · ') : null
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

export function TasksTable({
  items,
  userNameById,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
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
                  {crmLabel(item) ? (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground lg:hidden">
                      {crmLabel(item)}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                    Due {formatDate(item.dueAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={item.priority} />
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatDate(item.dueAt)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {assignedName || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {crmLabel(item) || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(item.createdAt)}
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
