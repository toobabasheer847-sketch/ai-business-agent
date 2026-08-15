import { Search } from 'lucide-react'

import { LEAD_STATUSES } from '@/features/leads/types/lead.types'
import type { Company } from '@/features/companies/types/company.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type LeadsFiltersProps = {
  search: string
  status: string
  companyId: string
  source: string
  companies: Company[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onCompanyIdChange: (value: string) => void
  onSourceChange: (value: string) => void
  onReset: () => void
}

export function LeadsFilters({
  search,
  status,
  companyId,
  source,
  companies,
  onSearchChange,
  onStatusChange,
  onCompanyIdChange,
  onSourceChange,
  onReset,
}: LeadsFiltersProps) {
  const hasFilters = Boolean(search || status || companyId || source)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          aria-label="Search leads"
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
          {LEAD_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={companyId || 'all'}
        onValueChange={(value) =>
          onCompanyIdChange(value === 'all' ? '' : value)
        }
      >
        <SelectTrigger className="w-full lg:w-[200px]">
          <SelectValue placeholder="Company" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All companies</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        placeholder="Filter by source…"
        className="w-full lg:w-[180px]"
        aria-label="Filter by source"
      />

      {hasFilters && (
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
