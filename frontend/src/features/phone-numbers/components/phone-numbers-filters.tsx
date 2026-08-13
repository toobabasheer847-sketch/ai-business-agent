import { Search } from 'lucide-react'

import {
  PHONE_NUMBER_PROVIDERS,
  PHONE_NUMBER_STATUSES,
  type PhoneNumberProvider,
  type PhoneNumberStatus,
} from '@/features/phone-numbers/types/phone-number.types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type PhoneNumbersFiltersProps = {
  search: string
  provider: string
  status: string
  onSearchChange: (value: string) => void
  onProviderChange: (value: string) => void
  onStatusChange: (value: string) => void
  onReset: () => void
}

export function PhoneNumbersFilters({
  search,
  provider,
  status,
  onSearchChange,
  onProviderChange,
  onStatusChange,
  onReset,
}: PhoneNumbersFiltersProps) {
  const hasFilters = Boolean(search || provider || status)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by number or label…"
          className="pl-9"
        />
      </div>

      <Select
        value={provider || 'all'}
        onValueChange={(value) => onProviderChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All providers</SelectItem>
          {PHONE_NUMBER_PROVIDERS.map((item) => (
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
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {PHONE_NUMBER_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
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

export function toPhoneNumberQuery(filters: {
  search: string
  provider: string
  status: string
}) {
  return {
    search: filters.search.trim() || undefined,
    provider: (filters.provider || undefined) as PhoneNumberProvider | undefined,
    status: (filters.status || undefined) as PhoneNumberStatus | undefined,
  }
}
