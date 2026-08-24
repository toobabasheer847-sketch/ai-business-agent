import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
import {
  PhoneNumberProviderBadge,
  PhoneNumberStatusBadge,
  TwilioConnectedBadge,
} from '@/features/phone-numbers/components/phone-number-badges'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PhoneNumbersTableProps = {
  items: PhoneNumber[]
  onEdit: (item: PhoneNumber) => void
  onDelete: (item: PhoneNumber) => void
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

export function PhoneNumbersTable({ items, onEdit, onDelete }: PhoneNumbersTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-xl border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phone number</TableHead>
            <TableHead className="hidden sm:table-cell">Label</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Twilio</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.phoneNumber}</div>
                <div className="text-xs text-muted-foreground sm:hidden">
                  {item.label || '—'}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{item.label || '—'}</TableCell>
              <TableCell>
                <PhoneNumberProviderBadge provider={item.provider} />
              </TableCell>
              <TableCell>
                <PhoneNumberStatusBadge status={item.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <TwilioConnectedBadge
                  connected={Boolean(
                    item.hasAuthToken || item.twilioSid || item.appSid || item.webhookUrl,
                  )}
                />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDate(item.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onEdit(item)}
                    aria-label={`Edit ${item.phoneNumber}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onDelete(item)}
                    aria-label={`Delete ${item.phoneNumber}`}
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
