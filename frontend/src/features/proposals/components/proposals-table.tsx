import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { ProposalStatusBadge } from '@/features/proposals/components/proposal-status-badge'
import type { Proposal } from '@/features/proposals/types/proposal.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ProposalsTableProps = {
  items: Proposal[]
  prospectNameById: Map<string, string>
  onEdit: (item: Proposal) => void
  onDelete: (item: Proposal) => void
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

function truncate(value: string | null, max = 80) {
  if (!value?.trim()) return '—'
  const text = value.trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

export function ProposalsTable({
  items,
  prospectNameById,
  onEdit,
  onDelete,
}: ProposalsTableProps) {
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
            <TableHead>Prospect</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead className="hidden lg:table-cell">Created At</TableHead>
            <TableHead className="hidden xl:table-cell">Updated At</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const prospectName =
              prospectNameById.get(item.prospectId) ?? 'Unknown prospect'

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground md:hidden">
                    {truncate(item.description, 48)}
                  </div>
                </TableCell>
                <TableCell>{prospectName}</TableCell>
                <TableCell>
                  <ProposalStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="hidden max-w-[240px] text-muted-foreground md:table-cell">
                  {truncate(item.description)}
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
                      aria-label={`Edit ${item.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${item.title}`}
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
