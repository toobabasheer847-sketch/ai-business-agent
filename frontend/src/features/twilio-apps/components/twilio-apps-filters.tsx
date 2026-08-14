import { Search } from 'lucide-react'

import {
  TWILIO_APP_STATUSES,
  type TwilioAppStatus,
} from '@/features/twilio-apps/types/twilio-app.types'
import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type TwilioAppsFiltersProps = {
  search: string
  status: string
  phoneNumberId: string
  phoneNumbers: PhoneNumber[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onPhoneNumberChange: (value: string) => void
  onReset: () => void
}

export function TwilioAppsFilters({
  search,
  status,
  phoneNumberId,
  phoneNumbers,
  onSearchChange,
  onStatusChange,
  onPhoneNumberChange,
  onReset,
}: TwilioAppsFiltersProps) {
  const hasFilters = Boolean(search || status || phoneNumberId)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Account SID, App SID, or webhook…"
          className="pl-9"
        />
      </div>

      <Select
        value={phoneNumberId || 'all'}
        onValueChange={(value) =>
          onPhoneNumberChange(value === 'all' ? '' : value)
        }
      >
        <SelectTrigger className="w-full lg:w-[220px]">
          <SelectValue placeholder="Phone number" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All phone numbers</SelectItem>
          {phoneNumbers.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.phoneNumber}
              {item.label ? ` (${item.label})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status || 'all'}
        onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {TWILIO_APP_STATUSES.map((item) => (
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

export function toTwilioAppQuery(filters: {
  search: string
  status: string
  phoneNumberId: string
}) {
  return {
    search: filters.search.trim() || undefined,
    status: (filters.status || undefined) as TwilioAppStatus | undefined,
    phoneNumberId: filters.phoneNumberId || undefined,
  }
}
