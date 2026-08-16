import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { UserStatusBadge } from '@/features/users/components/user-status-badge'
import type { User } from '@/features/users/types/user.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type UsersTableProps = {
  items: User[]
  currentUserId?: string | null
  onEdit: (item: User) => void
  onDelete: (item: User) => void
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function UsersTable({
  items,
  currentUserId,
  onEdit,
  onDelete,
}: UsersTableProps) {
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
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created At</TableHead>
            <TableHead className="hidden lg:table-cell">Updated At</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isSelf = item.id === currentUserId

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {isSelf ? (
                    <div className="text-xs text-muted-foreground">You</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.email}
                </TableCell>
                <TableCell>
                  <UserStatusBadge isActive={item.isActive} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(item.createdAt)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(item.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={isSelf}
                      onClick={() => onDelete(item)}
                      aria-label={
                        isSelf
                          ? 'You cannot delete your own account'
                          : `Delete ${item.name}`
                      }
                      title={
                        isSelf
                          ? 'You cannot delete your own account'
                          : undefined
                      }
                    >
                      <Trash2
                        className={`size-4 ${isSelf ? '' : 'text-destructive'}`}
                      />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </motion.div>
  )
}
