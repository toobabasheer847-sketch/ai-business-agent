import { Search } from 'lucide-react'

import { PROSPECT_STATUSES } from '@/features/prospects/types/prospect.types'
import type { Company } from '@/features/companies/types/company.types'
import type { Lead } from '@/features/leads/types/lead.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ProspectsFiltersProps = {
  search: string
  status: string
  companyId: string
  leadId: string
  companies: Company[]
  leads: Lead[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onCompanyIdChange: (value: string) => void
  onLeadIdChange: (value: string) => void
  onReset: () => void
}

function leadLabel(lead: Lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ')
}

export function ProspectsFilters({
  search,
  status,
  companyId,
  leadId,
  companies,
  leads,
  onSearchChange,
  onStatusChange,
  onCompanyIdChange,
  onLeadIdChange,
  onReset,
}: ProspectsFiltersProps) {
  const hasFilters = Boolean(search || status || companyId || leadId)

  const filteredLeads = companyId
    ? leads.filter((lead) => lead.companyId === companyId)
    : leads

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          aria-label="Search prospects"
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
          {PROSPECT_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={companyId || 'all'}
        onValueChange={(value) => {
          const next = value === 'all' ? '' : value
          onCompanyIdChange(next)
          onLeadIdChange('')
        }}
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

      <Select
        value={leadId || 'all'}
        onValueChange={(value) => onLeadIdChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[200px]">
          <SelectValue placeholder="Lead" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All leads</SelectItem>
          {filteredLeads.map((lead) => (
            <SelectItem key={lead.id} value={lead.id}>
              {leadLabel(lead)}
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
