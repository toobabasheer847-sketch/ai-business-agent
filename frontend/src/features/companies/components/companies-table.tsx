import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import type { Company } from '@/features/companies/types/company.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CompaniesTableProps = {
  items: Company[]
  onEdit: (item: Company) => void
  onDelete: (item: Company) => void
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
  if (!value) return '—'
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

export function CompaniesTable({ items, onEdit, onDelete }: CompaniesTableProps) {
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
            <TableHead className="hidden sm:table-cell">Domain</TableHead>
            <TableHead className="hidden md:table-cell">Website</TableHead>
            <TableHead className="hidden lg:table-cell">Industry</TableHead>
            <TableHead className="hidden xl:table-cell">Description</TableHead>
            <TableHead className="hidden md:table-cell">Created At</TableHead>
            <TableHead className="hidden lg:table-cell">Updated At</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground sm:hidden">
                  {item.domain || '—'}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {item.domain || '—'}
              </TableCell>
              <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                {item.website ? (
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {item.website}
                  </a>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {item.industry || '—'}
              </TableCell>
              <TableCell
                className="hidden max-w-[240px] text-muted-foreground xl:table-cell"
                title={item.description ?? undefined}
              >
                {truncate(item.description)}
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
                    onClick={() => onDelete(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  )
}
