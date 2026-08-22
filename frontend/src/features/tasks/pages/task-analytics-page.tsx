import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

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
import { cn } from '@/lib/utils'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useLeads } from '@/features/leads/hooks/use-leads'
import { useProspects } from '@/features/prospects/hooks/use-prospects'
import { useUsers } from '@/features/users/hooks/use-users'
import {
  useExportTaskAnalyticsCsv,
  useTaskAnalytics,
  useTaskAnalyticsTrends,
} from '@/features/tasks/hooks/use-tasks'
import {
  DATE_PRESET_LABELS,
  formatUtcRangeLabel,
  resolveDatePresetRange,
  type DatePreset,
} from '@/features/tasks/lib/date-presets'
import { buildTasksListHref } from '@/features/tasks/lib/tasks-href'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskAnalyticsGroupBy,
  type TaskAnalyticsQuery,
} from '@/features/tasks/types/task.types'

const ALL = 'all'

const DATE_PRESET_ORDER: DatePreset[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_30_days',
  'last_90_days',
  'custom',
]

const TREND_GROUPS: Array<{ id: TaskAnalyticsGroupBy; label: string }> = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
]

function toIsoStart(date: string) {
  return date ? `${date}T00:00:00.000Z` : undefined
}

function toIsoEnd(date: string) {
  return date ? `${date}T23:59:59.999Z` : undefined
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

function downloadCsvBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function TaskAnalyticsPage() {
  const defaults = resolveDatePresetRange('last_30_days') ?? { from: '', to: '' }
  const [preset, setPreset] = useState<DatePreset>('last_30_days')
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
      from: toIsoStart(from),
      to: toIsoEnd(to),
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
  const exportMutation = useExportTaskAnalyticsCsv()

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
  const linkedTasks = analytics
    ? Math.max(0, analytics.summary.total - analytics.crm.unlinked)
    : 0

  const listHref = (input: Parameters<typeof buildTasksListHref>[0]) =>
    buildTasksListHref({
      companyId: companyId || undefined,
      prospectId: prospectId || undefined,
      leadId: leadId || undefined,
      assigneeId: assigneeId || undefined,
      ...input,
    })

  function applyPreset(next: DatePreset) {
    setPreset(next)
    if (next === 'custom') return
    const range = resolveDatePresetRange(next)
    if (range) {
      setFrom(range.from)
      setTo(range.to)
    }
  }

  function onCustomDateChange(field: 'from' | 'to', value: string) {
    setPreset('custom')
    if (field === 'from') setFrom(value)
    else setTo(value)
  }

  function resetFilters() {
    const range = resolveDatePresetRange('last_30_days') ?? { from: '', to: '' }
    setPreset('last_30_days')
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

  async function handleExport() {
    try {
      const blob = await exportMutation.mutateAsync(query)
      downloadCsvBlob(blob, 'task-analytics.csv')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
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
              onClick={() => void handleExport()}
              disabled={exportMutation.isPending}
            >
              <Download className="size-4" />
              {exportMutation.isPending ? 'Exporting…' : 'Export CSV'}
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

      <div className="mb-4 rounded-xl border bg-card p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Date range</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {DATE_PRESET_ORDER.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={preset === item ? 'default' : 'outline'}
              onClick={() => applyPreset(item)}
            >
              {DATE_PRESET_LABELS[item]}
            </Button>
          ))}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Active range:{' '}
          <span className="font-medium text-foreground">
            {formatUtcRangeLabel(from, to)}
          </span>
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid gap-1">
            <Label htmlFor="analytics-from">From</Label>
            <Input
              id="analytics-from"
              type="date"
              value={from}
              onChange={(event) => onCustomDateChange('from', event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="analytics-to">To</Label>
            <Input
              id="analytics-to"
              type="date"
              value={to}
              onChange={(event) => onCustomDateChange('to', event.target.value)}
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
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 12 }).map((_, index) => (
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total tasks" value={analytics.summary.total} to={listHref({})} />
            <KpiCard
              title="Pending"
              value={analytics.summary.pending}
              to={listHref({ status: 'pending' })}
            />
            <KpiCard
              title="In Progress"
              value={analytics.summary.inProgress}
              to={listHref({ status: 'in_progress' })}
            />
            <KpiCard
              title="Completed"
              value={analytics.summary.completed}
              to={listHref({ status: 'completed' })}
            />
            <KpiCard
              title="Cancelled"
              value={analytics.summary.cancelled}
              to={listHref({ status: 'cancelled' })}
            />
            <KpiCard
              title="Overdue"
              value={analytics.summary.overdue}
              to={listHref({ overdue: true })}
            />
            <KpiCard title="Completion rate" value={`${analytics.completionRate}%`} />
            <KpiCard title="Overdue rate" value={`${analytics.overdueRate}%`} />
            <KpiCard
              title="Tasks with reminders"
              value={analytics.summary.withReminders}
              to={listHref({ hasReminder: true })}
            />
            <KpiCard
              title="Reminder sent rate"
              value={`${analytics.reminderSuccessRate}%`}
            />
            <KpiCard
              title="Reminder failed rate"
              value={`${analytics.reminderFailureRate}%`}
            />
            <KpiCard
              title="CRM-linked tasks"
              value={linkedTasks}
              to={
                companyId
                  ? listHref({ companyId })
                  : prospectId
                    ? listHref({ prospectId })
                    : leadId
                      ? listHref({ leadId })
                      : undefined
              }
            />
            <KpiCard title="Unlinked tasks" value={analytics.crm.unlinked} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <BreakdownCard
              title="Priority"
              items={[
                {
                  label: 'Low',
                  value: analytics.priority.low,
                  to: listHref({ priority: 'low' }),
                },
                {
                  label: 'Medium',
                  value: analytics.priority.medium,
                  to: listHref({ priority: 'medium' }),
                },
                {
                  label: 'High',
                  value: analytics.priority.high,
                  to: listHref({ priority: 'high' }),
                },
                {
                  label: 'Urgent',
                  value: analytics.priority.urgent,
                  to: listHref({ priority: 'urgent' }),
                },
                {
                  label: 'High open',
                  value: analytics.summary.highPriorityOpen,
                  to: listHref({ priority: 'high' }),
                },
                {
                  label: 'Urgent open',
                  value: analytics.summary.urgentOpen,
                  to: listHref({ priority: 'urgent' }),
                },
              ]}
            />
            <BreakdownCard
              title="CRM links"
              items={[
                {
                  label: 'Company',
                  value: analytics.crm.company,
                  to: companyId ? listHref({ companyId }) : undefined,
                },
                {
                  label: 'Prospect',
                  value: analytics.crm.prospect,
                  to: prospectId ? listHref({ prospectId }) : undefined,
                },
                {
                  label: 'Lead',
                  value: analytics.crm.lead,
                  to: leadId ? listHref({ leadId }) : undefined,
                },
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

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">Trends</h2>
              <div className="flex flex-wrap gap-2">
                {TREND_GROUPS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={groupBy === item.id ? 'default' : 'outline'}
                    onClick={() => setGroupBy(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <TrendCard title="Created tasks" metric="created" trends={trends} />
              <TrendCard title="Completed tasks" metric="completed" trends={trends} />
              <TrendCard title="Overdue tasks" metric="overdue" trends={trends} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({
  title,
  value,
  to,
}: {
  title: string
  value: number | string
  to?: string
}) {
  const card = (
    <Card className={cn(to && 'transition-colors hover:bg-muted/40')}>
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

  if (!to) return card
  return (
    <Link to={to} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2">
      {card}
    </Link>
  )
}

function BreakdownCard({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: number; suffix?: string; to?: string }>
}) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const row = (
            <>
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
            </>
          )
          if (!item.to) {
            return (
              <div key={item.label} className="space-y-1">
                {row}
              </div>
            )
          }
          return (
            <Link
              key={item.label}
              to={item.to}
              className="block space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 hover:bg-muted/40"
            >
              {row}
            </Link>
          )
        })}
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
