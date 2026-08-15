import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { ProspectStatusBadge } from '@/features/prospects/components/prospect-status-badge'
import type { Prospect } from '@/features/prospects/types/prospect.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ProspectsTableProps = {
  items: Prospect[]
  companyNameById: Map<string, string>
  leadNameById: Map<string, string>
  onEdit: (item: Prospect) => void
  onDelete: (item: Prospect) => void
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

function fullName(prospect: Prospect) {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

export function ProspectsTable({
  items,
  companyNameById,
  leadNameById,
  onEdit,
  onDelete,
}: ProspectsTableProps) {
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
            <TableHead>Company</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead className="hidden md:table-cell">Phone</TableHead>
            <TableHead className="hidden lg:table-cell">Job Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Created At</TableHead>
            <TableHead className="hidden xl:table-cell">Updated At</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const name = fullName(item)
            const companyName =
              companyNameById.get(item.companyId) ?? 'Unknown company'
            const leadName = leadNameById.get(item.leadId) ?? 'Unknown lead'

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">
                    {item.email || '—'}
                  </div>
                </TableCell>
                <TableCell>{companyName}</TableCell>
                <TableCell>{leadName}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {item.email || '—'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {item.phone || '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {item.jobTitle || '—'}
                </TableCell>
                <TableCell>
                  <ProspectStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(item.createdAt)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {formatDate(item.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
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
