import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useLeads } from '@/features/leads/hooks/use-leads'
import { useProspects } from '@/features/prospects/hooks/use-prospects'
import { useUsers } from '@/features/users/hooks/use-users'
import {
  useTaskAnalytics,
  useTaskAnalyticsTrends,
} from '@/features/tasks/hooks/use-tasks'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskAnalyticsGroupBy,
  type TaskAnalyticsQuery,
} from '@/features/tasks/types/task.types'

const ALL = 'all'

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000)
  return { from: isoDate(from), to: isoDate(to) }
}

function toIsoStart(date: string) {
  return `${date}T00:00:00.000Z`
}

function toIsoEnd(date: string) {
  return `${date}T23:59:59.999Z`
}

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

export function TaskAnalyticsPage() {
  const defaults = defaultRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [groupBy, setGroupBy] = useState<TaskAnalyticsGroupBy>('day')

  const query = useMemo<TaskAnalyticsQuery>(
    () => ({
      from: from ? toIsoStart(from) : undefined,
      to: to ? toIsoEnd(to) : undefined,
      status: status || undefined,
      priority: priority || undefined,
      companyId: companyId || undefined,
      prospectId: prospectId || undefined,
      leadId: leadId || undefined,
      assigneeId: assigneeId || undefined,
      groupBy,
    }),
    [from, to, status, priority, companyId, prospectId, leadId, assigneeId, groupBy],
  )

  const companiesQuery = useCompanies()
  const leadsQuery = useLeads()
  const prospectsQuery = useProspects()
  const usersQuery = useUsers()
  const analyticsQuery = useTaskAnalytics(query)
  const trendsQuery = useTaskAnalyticsTrends(query)

  const companies = companiesQuery.data ?? []
  const leads = leadsQuery.data ?? []
  const prospects = prospectsQuery.data ?? []
  const users = usersQuery.data ?? []
  const analytics = analyticsQuery.data
  const trends = trendsQuery.data?.trends ?? []
  const isLoading = analyticsQuery.isLoading || trendsQuery.isLoading
  const isError = analyticsQuery.isError || trendsQuery.isError
  const error = analyticsQuery.error ?? trendsQuery.error
  const hasFilters = Boolean(
    status || priority || companyId || prospectId || leadId || assigneeId,
  )
  const isEmpty = analytics?.summary.total === 0

  function resetFilters() {
    const range = defaultRange()
    setFrom(range.from)
    setTo(range.to)
    setStatus('')
    setPriority('')
    setCompanyId('')
    setProspectId('')
    setLeadId('')
    setAssigneeId('')
    setGroupBy('day')
  }

  return (
    <div>
      <PageHeader
        title="Task Analytics"
        description="Productivity reporting for tasks you created or that are assigned to you. Tenant and user come from your session."
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <Link to="/tasks">
                <ArrowLeft className="size-4" />
                Back to tasks
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void analyticsQuery.refetch()
                void trendsQuery.refetch()
              }}
              disabled={analyticsQuery.isFetching || trendsQuery.isFetching}
            >
              <RefreshCw
                className={`size-4 ${analyticsQuery.isFetching || trendsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid gap-1">
          <Label htmlFor="analytics-from">From</Label>
          <Input
            id="analytics-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="analytics-to">To</Label>
          <Input
            id="analytics-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <Select
          value={status || ALL}
          onValueChange={(value) => setStatus(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full capitalize lg:w-[160px]" aria-label="Status">
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
          onValueChange={(value) => setPriority(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full capitalize lg:w-[150px]" aria-label="Priority">
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
          value={companyId || ALL}
          onValueChange={(value) => setCompanyId(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]" aria-label="Company">
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
          onValueChange={(value) => setProspectId(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]" aria-label="Prospect">
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
          onValueChange={(value) => setLeadId(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]" aria-label="Lead">
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
        <Select
          value={assigneeId || ALL}
          onValueChange={(value) => setAssigneeId(value === ALL ? '' : value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]" aria-label="Assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All assignees</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={groupBy}
          onValueChange={(value) => setGroupBy(value as TaskAnalyticsGroupBy)}
        >
          <SelectTrigger className="w-full lg:w-[140px]" aria-label="Group trends by">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" onClick={resetFilters}>
          Reset filters
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void analyticsQuery.refetch()
                void trendsQuery.refetch()
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No task analytics yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters || from || to
              ? 'No tasks match these filters. Try a wider date range or reset filters.'
              : 'Create a task to start seeing productivity reporting.'}
          </p>
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard title="Total Tasks" value={analytics.summary.total} />
            <KpiCard title="Pending" value={analytics.summary.pending} />
            <KpiCard title="In Progress" value={analytics.summary.inProgress} />
            <KpiCard title="Completed" value={analytics.summary.completed} />
            <KpiCard title="Overdue" value={analytics.summary.overdue} />
            <KpiCard title="Due Today" value={analytics.summary.dueToday} />
            <KpiCard title="Due Tomorrow" value={analytics.summary.dueTomorrow} />
            <KpiCard
              title="Completion Rate"
              value={`${analytics.completionRate}%`}
            />
            <KpiCard title="Overdue Rate" value={`${analytics.overdueRate}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <BreakdownCard
              title="Priority"
              items={[
                { label: 'Low', value: analytics.priority.low },
                { label: 'Medium', value: analytics.priority.medium },
                { label: 'High', value: analytics.priority.high },
                { label: 'Urgent', value: analytics.priority.urgent },
                {
                  label: 'High open',
                  value: analytics.summary.highPriorityOpen,
                },
                { label: 'Urgent open', value: analytics.summary.urgentOpen },
              ]}
            />
            <BreakdownCard
              title="CRM links"
              items={[
                { label: 'Company', value: analytics.crm.company },
                { label: 'Prospect', value: analytics.crm.prospect },
                { label: 'Lead', value: analytics.crm.lead },
                { label: 'Unlinked', value: analytics.crm.unlinked },
              ]}
            />
            <BreakdownCard
              title="Reminders"
              items={[
                { label: 'Scheduled', value: analytics.reminders.scheduled },
                { label: 'Processing', value: analytics.reminders.processing },
                { label: 'Sent', value: analytics.reminders.sent },
                { label: 'Failed', value: analytics.reminders.failed },
                { label: 'Cancelled', value: analytics.reminders.cancelled },
                { label: 'Disabled', value: analytics.reminders.disabled },
                {
                  label: 'Success rate',
                  value: analytics.reminderSuccessRate,
                  suffix: '%',
                },
                {
                  label: 'Failure rate',
                  value: analytics.reminderFailureRate,
                  suffix: '%',
                },
              ]}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <TrendCard title="Task trend" metric="created" trends={trends} />
            <TrendCard title="Completion trend" metric="completed" trends={trends} />
            <TrendCard title="Overdue trend" metric="overdue" trends={trends} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: number; suffix?: string }>
}) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{item.label}</span>
              <span className="tabular-nums">
                {item.value}
                {item.suffix ?? ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-foreground"
                style={{ width: `${Math.round((item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TrendCard({
  title,
  metric,
  trends,
}: {
  title: string
  metric: 'created' | 'completed' | 'overdue'
  trends: Array<{ period: string; created: number; completed: number; overdue: number }>
}) {
  const max = Math.max(1, ...trends.map((item) => item[metric]))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trend data for this range.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {trends.map((item) => (
              <div
                key={`${metric}-${item.period}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
                title={`${item.period}: ${item[metric]}`}
              >
                <div
                  className="w-full rounded-t bg-foreground/80"
                  style={{ height: `${Math.round((item[metric] / max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
