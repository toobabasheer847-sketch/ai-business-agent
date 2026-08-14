import { Eye, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import type { TwilioApp } from '@/features/twilio-apps/types/twilio-app.types'
import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
import {
  TwilioAppStatusBadge,
  truncateSid,
} from '@/features/twilio-apps/components/twilio-app-badges'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type TwilioAppsTableProps = {
  items: TwilioApp[]
  phoneNumbersById: Map<string, PhoneNumber>
  onView: (item: TwilioApp) => void
  onEdit: (item: TwilioApp) => void
  onDelete: (item: TwilioApp) => void
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

function phoneLabel(
  phoneNumberId: string,
  phoneNumbersById: Map<string, PhoneNumber>,
) {
  const phone = phoneNumbersById.get(phoneNumberId)
  if (!phone) return phoneNumberId.slice(0, 8) + '…'
  return phone.label
    ? `${phone.phoneNumber} (${phone.label})`
    : phone.phoneNumber
}

export function TwilioAppsTable({
  items,
  phoneNumbersById,
  onView,
  onEdit,
  onDelete,
}: TwilioAppsTableProps) {
  return (
    <>
      {/* Desktop / tablet table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="hidden overflow-hidden rounded-xl border md:block"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Account SID</TableHead>
              <TableHead className="hidden lg:table-cell">App SID</TableHead>
              <TableHead className="hidden xl:table-cell">Webhook</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TwilioAppStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="font-medium">
                  {phoneLabel(item.phoneNumberId, phoneNumbersById)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {truncateSid(item.accountSid)}
                </TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {truncateSid(item.appSid)}
                </TableCell>
                <TableCell className="hidden max-w-[200px] truncate text-muted-foreground xl:table-cell">
                  {item.webhookUrl || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(item.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onView(item)}
                      aria-label="View Twilio App"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      aria-label="Edit Twilio App"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      aria-label="Delete Twilio App"
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

      {/* Mobile cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-3 md:hidden"
      >
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {phoneLabel(item.phoneNumberId, phoneNumbersById)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {truncateSid(item.accountSid)}
                </div>
              </div>
              <TwilioAppStatusBadge status={item.status} />
            </div>
            <div className="mb-3 space-y-1 text-sm text-muted-foreground">
              <p>App SID: {truncateSid(item.appSid)}</p>
              <p className="truncate">Webhook: {item.webhookUrl || '—'}</p>
              <p>Created: {formatDate(item.createdAt)}</p>
            </div>
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onView(item)}
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(item)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onDelete(item)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </motion.div>
    </>
  )
}
