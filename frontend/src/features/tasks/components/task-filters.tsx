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
import type { Company } from '@/features/companies/types/company.types'
import type { Lead } from '@/features/leads/types/lead.types'
import type { Prospect } from '@/features/prospects/types/prospect.types'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/features/tasks/types/task.types'

type TaskDueWindow = '' | 'overdue' | 'today' | 'tomorrow' | 'upcoming'

type TaskFiltersProps = {
  search: string
  status: string
  priority: string
  dueWindow: TaskDueWindow
  companyId: string
  prospectId: string
  leadId: string
  companies: Company[]
  prospects: Prospect[]
  leads: Lead[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onDueWindowChange: (value: TaskDueWindow) => void
  onCompanyChange: (value: string) => void
  onProspectChange: (value: string) => void
  onLeadChange: (value: string) => void
  onReset: () => void
}

const ALL = 'all'

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function personLabel(item: {
  firstName: string
  lastName: string | null
  email?: string | null
}) {
  const name = [item.firstName, item.lastName].filter(Boolean).join(' ')
  return item.email ? `${name} (${item.email})` : name
}

export function TaskFilters({
  search,
  status,
  priority,
  dueWindow,
  companyId,
  prospectId,
  leadId,
  companies,
  prospects,
  leads,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onDueWindowChange,
  onCompanyChange,
  onProspectChange,
  onLeadChange,
  onReset,
}: TaskFiltersProps) {
  const hasFilters = Boolean(
    search || status || priority || dueWindow || companyId || prospectId || leadId,
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title or description…"
          className="pl-9"
          aria-label="Search tasks"
        />
      </div>

      <Select
        value={status || ALL}
        onValueChange={(value) => onStatusChange(value === ALL ? '' : value)}
      >
        <SelectTrigger className="w-full capitalize lg:w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {TASK_STATUSES.map((item) => (
            <SelectItem key={item} value={item} className="capitalize">
              {formatStatus(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={priority || ALL}
        onValueChange={(value) =>
          onPriorityChange(value === ALL ? '' : value)
        }
      >
        <SelectTrigger className="w-full capitalize lg:w-[160px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {TASK_PRIORITIES.map((item) => (
            <SelectItem key={item} value={item} className="capitalize">
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={dueWindow || ALL}
        onValueChange={(value) =>
          onDueWindowChange(value === ALL ? '' : (value as TaskDueWindow))
        }
      >
        <SelectTrigger className="w-full lg:w-[170px]" aria-label="Due window">
          <SelectValue placeholder="Due" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All due dates</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="today">Due today</SelectItem>
          <SelectItem value="tomorrow">Due tomorrow</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={companyId || ALL}
        onValueChange={(value) => onCompanyChange(value === ALL ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[190px]" aria-label="Company">
          <SelectValue placeholder="Company" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All companies</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={prospectId || ALL}
        onValueChange={(value) => onProspectChange(value === ALL ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[190px]" aria-label="Prospect">
          <SelectValue placeholder="Prospect" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All prospects</SelectItem>
          {prospects.map((prospect) => (
            <SelectItem key={prospect.id} value={prospect.id}>
              {personLabel(prospect)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={leadId || ALL}
        onValueChange={(value) => onLeadChange(value === ALL ? '' : value)}
      >
        <SelectTrigger className="w-full lg:w-[190px]" aria-label="Lead">
          <SelectValue placeholder="Lead" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All leads</SelectItem>
          {leads.map((lead) => (
            <SelectItem key={lead.id} value={lead.id}>
              {personLabel(lead)}
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
