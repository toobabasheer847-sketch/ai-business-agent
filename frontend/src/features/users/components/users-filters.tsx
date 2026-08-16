import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type UsersFiltersProps = {
  search: string
  isActive: '' | 'true' | 'false'
  onSearchChange: (value: string) => void
  onIsActiveChange: (value: '' | 'true' | 'false') => void
  onReset: () => void
}

export function UsersFilters({
  search,
  isActive,
  onSearchChange,
  onIsActiveChange,
  onReset,
}: UsersFiltersProps) {
  const hasFilters = Boolean(search || isActive)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      <Select
        value={isActive || 'all'}
        onValueChange={(value) =>
          onIsActiveChange(value === 'all' ? '' : (value as 'true' | 'false'))
        }
      >
        <SelectTrigger className="w-full lg:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
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
