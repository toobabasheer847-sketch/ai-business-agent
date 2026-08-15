import { Search } from 'lucide-react'

import { PROPOSAL_STATUSES } from '@/features/proposals/types/proposal.types'
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

type ProposalsFiltersProps = {
  search: string
  status: string
  prospectId: string
  prospects: Prospect[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onProspectIdChange: (value: string) => void
  onReset: () => void
}

function prospectLabel(prospect: Prospect) {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(' ')
}

export function ProposalsFilters({
  search,
  status,
  prospectId,
  prospects,
  onSearchChange,
  onStatusChange,
  onProspectIdChange,
  onReset,
}: ProposalsFiltersProps) {
  const hasFilters = Boolean(search || status || prospectId)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title or description…"
          className="pl-9"
          aria-label="Search proposals"
        />
      </div>

      <Select
        value={status || 'all'}
        onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {PROPOSAL_STATUSES.map((item) => (
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
