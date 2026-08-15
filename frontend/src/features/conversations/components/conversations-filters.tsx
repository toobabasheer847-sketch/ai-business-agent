import { Search } from 'lucide-react'

import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
} from '@/features/conversations/types/conversation.types'
import type { Prospect } from '@/features/prospects/types/prospect.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ConversationsFiltersProps = {
  search: string
  channel: string
  status: string
  prospectId: string
  prospects: Prospect[]
  onSearchChange: (value: string) => void
  onChannelChange: (value: string) => void
  onStatusChange: (value: string) => void
  onProspectIdChange: (value: string) => void
  onReset: () => void
}

function prospectLabel(prospect: Prospect) {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

export function ConversationsFilters({
  search,
  channel,
  status,
  prospectId,
  prospects,
  onSearchChange,
  onChannelChange,
  onStatusChange,
  onProspectIdChange,
  onReset,
}: ConversationsFiltersProps) {
  const hasFilters = Boolean(search || channel || status || prospectId)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title or summary…"
          className="pl-9"
          aria-label="Search conversations"
        />
      </div>

      <Select
        value={channel || 'all'}
        onValueChange={(value) => onChannelChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[140px]">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All channels</SelectItem>
          {CONVERSATION_CHANNELS.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status || 'all'}
        onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {CONVERSATION_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={prospectId || 'all'}
        onValueChange={(value) =>
          onProspectIdChange(value === 'all' ? '' : value)
        }
      >
        <SelectTrigger className="w-full lg:w-[200px]">
          <SelectValue placeholder="Prospect" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All prospects</SelectItem>
          {prospects.map((prospect) => (
            <SelectItem key={prospect.id} value={prospect.id}>
              {prospectLabel(prospect)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
