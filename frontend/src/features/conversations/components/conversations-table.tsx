import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { ConversationChannelBadge } from '@/features/conversations/components/conversation-channel-badge'
import { ConversationStatusBadge } from '@/features/conversations/components/conversation-status-badge'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ConversationsTableProps = {
  items: Conversation[]
  prospectNameById: Map<string, string>
  onOpen: (item: Conversation) => void
  onEdit: (item: Conversation) => void
  onDelete: (item: Conversation) => void
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

function conversationTitle(item: Conversation) {
  return item.title?.trim() || 'Untitled conversation'
}

export function ConversationsTable({
  items,
  prospectNameById,
  onOpen,
  onEdit,
  onDelete,
}: ConversationsTableProps) {
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
            <TableHead>Channel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Summary</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="hidden xl:table-cell">Updated</TableHead>
            <TableHead className="w-[140px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const title = conversationTitle(item)
            const prospectName = item.prospectId
              ? (prospectNameById.get(item.prospectId) ?? 'Unknown prospect')
              : 'No prospect'

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => onOpen(item)}
                  >
                    {title}
                  </button>
                  <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    {item.summary?.trim() || '—'}
                  </div>
                </TableCell>
                <TableCell>{prospectName}</TableCell>
                <TableCell>
                  <ConversationChannelBadge channel={item.channel} />
                </TableCell>
                <TableCell>
                  <ConversationStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="hidden max-w-[220px] truncate text-muted-foreground md:table-cell">
                  {item.summary?.trim() || '—'}
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
                      onClick={() => onOpen(item)}
                      aria-label={`Open ${title}`}
                    >
                      <MessageSquare className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${title}`}
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
