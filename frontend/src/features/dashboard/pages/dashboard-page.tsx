import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  CheckCircle2,
  FileText,
  ListTodo,
  Phone,
  Send,
  Target,
  Users,
} from 'lucide-react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { usePermissions } from '@/features/authorization/use-permissions'
import { exceptionsApi } from '@/features/exceptions/api/exceptions.api'
import { workflowsApi } from '@/features/workflows/api/workflows.api'
import { DashboardKpiCard } from '@/features/dashboard/components/dashboard-kpi-card'
import { DashboardSectionError } from '@/features/dashboard/components/dashboard-section-error'
import {
  useDashboardActivity,
  useDashboardCommunications,
  useDashboardCounts,
  useDashboardPipeline,
  useDashboardTasks,
} from '@/features/dashboard/hooks/use-dashboard'
import type { DashboardRangeQuery } from '@/features/dashboard/types/dashboard.types'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const RANGE_OPTIONS = [
  { id: 'lifetime', label: 'Lifetime' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
] as const

const ACTIVITY_LABELS: Record<string, string> = {
  'company.created': 'Company created',
  'lead.created': 'Lead created',
  'prospect.created': 'Prospect created',
  'proposal.generated': 'Proposal generated',
  'proposal.sent': 'Proposal sent',
  'proposal.accepted': 'Proposal accepted',
  'proposal.rejected': 'Proposal rejected',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
}

function BusinessNeedsAttention() {
  const { canAccess } = usePermissions()
  const enabled = canAccess(['audit.view'])
  const summary = useQuery({ queryKey: ['exceptions', 'summary'], queryFn: exceptionsApi.summary, enabled })
  const attention = useQuery({ queryKey: ['exceptions', 'attention'], queryFn: exceptionsApi.attention, enabled })
  if (!enabled) return null
  const critical = (attention.data ?? []).filter((item) => item.severity === 'critical').slice(0, 3)
  const high = (attention.data ?? []).filter((item) => item.severity === 'high').slice(0, 3)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Business Needs Attention</CardTitle>
        <Button asChild size="sm" variant="outline"><Link to="/exceptions">View all exceptions</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {summary.isLoading || attention.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {summary.isError || attention.isError ? (
          <DashboardSectionError error={summary.error ?? attention.error} onRetry={() => { void summary.refetch(); void attention.refetch() }} />
        ) : null}
        {summary.data ? <p>{summary.data.open} unresolved exceptions.</p> : null}
        {critical.map((item) => <p key={item.id}>Critical: {item.title}</p>)}
        {high.map((item) => <p key={item.id}>High: {item.title}</p>)}
        {summary.data && attention.data && critical.length === 0 && high.length === 0 ? <p className="text-muted-foreground">No critical or high exceptions are open.</p> : null}
      </CardContent>
    </Card>
  )
}

function WorkflowAutomation() {
  const { canAccess } = usePermissions()
  const enabled = canAccess(['workflow.manage'])
  const summary = useQuery({ queryKey: ['workflows', 'summary'], queryFn: workflowsApi.summary, enabled })
  if (!enabled) return null
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Workflow automation</CardTitle>
        <Button asChild size="sm" variant="outline"><Link to="/workflows">Open workflows</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {summary.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {summary.isError ? <DashboardSectionError error={summary.error} onRetry={() => { void summary.refetch() }} /> : null}
        {summary.data ? (
          <>
            <p>{summary.data.active} active workflows.</p>
            <p>{summary.data.waiting} executions waiting for approval.</p>
            {summary.data.recentFailures.slice(0, 5).map((item) => (
              <p key={item.id}>Failed: {item.sanitizedError ?? item.id}</p>
            ))}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function rangeLabel(query: DashboardRangeQuery): string {
  if (query.range === '7d') return 'Last 7 days (UTC)'
  if (query.range === '30d') return 'Last 30 days (UTC)'
  if (query.range === '90d') return 'Last 90 days (UTC)'
  if (query.range === 'custom') return 'Custom range (UTC)'
  return 'Lifetime totals'
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DashboardPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState<DashboardRangeQuery>({})
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const counts = useDashboardCounts(query)
  const pipeline = useDashboardPipeline(query)
  const tasks = useDashboardTasks(query)
  const activity = useDashboardActivity(query)
  const communications = useDashboardCommunications(query)
  const overview = counts.overview.data
  const activeCounts = overview?.filtered ?? overview?.lifetime
  const pipelineCounts = pipeline.data?.filtered ?? pipeline.data?.lifetime
  const taskCounts = tasks.data?.filtered
    ? {
        pending: tasks.data.filtered.pending,
        completed: tasks.data.filtered.completed,
        overdue: tasks.data.filtered.overdue,
        dueToday: tasks.data.current.dueToday,
        dueThisWeek: tasks.data.current.dueThisWeek,
      }
    : tasks.data?.current
  const communicationCounts = communications.data?.filtered ?? communications.data?.lifetime
  const proposalParts: Array<[string, number]> = activeCounts
    ? [
        ['Draft', activeCounts.draftProposals],
        ['Generated', activeCounts.generatedProposals],
        ['Sent', activeCounts.sentProposals],
        ['Viewed', activeCounts.viewedProposals],
        ['Accepted', activeCounts.acceptedProposals],
        ['Rejected', activeCounts.rejectedProposals],
      ]
    : []
  const proposalMax = Math.max(1, ...proposalParts.map(([, value]) => value))
  const pipelineMax = Math.max(
    1,
    pipelineCounts?.companies ?? 0,
    pipelineCounts?.leads ?? 0,
    pipelineCounts?.prospects ?? 0,
    pipelineCounts?.proposals ?? 0,
  )
  const isEmpty =
    !!overview &&
    overview.lifetime.companies === 0 &&
    overview.lifetime.leads === 0 &&
    overview.lifetime.prospects === 0 &&
    overview.lifetime.proposals === 0 &&
    overview.lifetime.pendingTasks === 0 &&
    overview.lifetime.completedTasks === 0

  return (
    <div className="space-y-6 bg-background text-foreground">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name}` : ''}`}
        description={`${rangeLabel(query)}. Due today and due this week stay on the current UTC calendar.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/companies">Companies</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/leads">Leads</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/proposals">Proposals</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/assistant">Open assistant</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={!query.range && option.id === 'lifetime' || query.range === option.id ? 'default' : 'outline'}
              aria-pressed={!query.range && option.id === 'lifetime' || query.range === option.id}
              onClick={() => setQuery(option.id === 'lifetime' ? {} : { range: option.id })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            if (!customFrom || !customTo) return
            setQuery({ range: 'custom', from: customFrom, to: customTo })
          }}
        >
          <label className="text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <Button type="submit" size="sm" variant="outline">
            Apply range
          </Button>
        </form>
      </div>

      {counts.isError ? (
        <DashboardSectionError
          title="Could not load KPIs"
          error={counts.error}
          onRetry={() => void counts.overview.refetch()}
        />
      ) : (
        <div
          data-testid="kpi-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <DashboardKpiCard title="Companies" value={counts.companies} icon={Building2} href="/companies" isLoading={counts.isLoading} description={rangeLabel(query)} />
          <DashboardKpiCard title="Leads" value={counts.leads} icon={Users} href="/leads" isLoading={counts.isLoading} description={overview ? `Lifetime ${overview.lifetime.leads}` : undefined} />
          <DashboardKpiCard title="Prospects" value={counts.prospects} icon={Target} href="/prospects" isLoading={counts.isLoading} description={overview ? `Lifetime ${overview.lifetime.prospects}` : undefined} />
          <DashboardKpiCard title="Proposals" value={counts.proposals} icon={FileText} href="/proposals" isLoading={counts.isLoading} description={overview ? `Lifetime ${overview.lifetime.proposals}` : undefined} />
          <DashboardKpiCard title="Draft proposals" value={activeCounts?.draftProposals} icon={FileText} href="/proposals" isLoading={counts.isLoading} />
          <DashboardKpiCard title="Sent proposals" value={activeCounts?.sentProposals} icon={Send} href="/proposals" isLoading={counts.isLoading} description="Current status, or sent in the selected period" />
          <DashboardKpiCard title="Accepted" value={activeCounts?.acceptedProposals} icon={CheckCircle2} href="/proposals" isLoading={counts.isLoading} />
          <DashboardKpiCard title="Rejected" value={activeCounts?.rejectedProposals} icon={FileText} href="/proposals" isLoading={counts.isLoading} />
          <DashboardKpiCard title="Pending tasks" value={activeCounts?.pendingTasks} icon={ListTodo} href="/tasks" isLoading={counts.isLoading} />
          <DashboardKpiCard title="Completed tasks" value={activeCounts?.completedTasks} icon={CheckCircle2} href="/tasks" isLoading={counts.isLoading} />
          <DashboardKpiCard title="Overdue tasks" value={activeCounts?.overdueTasks} icon={ListTodo} href="/tasks" isLoading={counts.isLoading} description="Open tasks past their due time" />
        </div>
      )}

      <BusinessNeedsAttention />
      <WorkflowAutomation />

      {taskCounts && (taskCounts.overdue > 0 || taskCounts.dueToday > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              {taskCounts.overdue} overdue and {taskCounts.dueToday} due today. These counts come from the task summary.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/tasks">Review tasks</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="No CRM records yet"
          description="Add a company, lead, or proposal to fill this dashboard."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipeline.isLoading ? <Skeleton className="h-28 w-full" /> : null}
            {pipeline.isError ? (
              <DashboardSectionError error={pipeline.error} onRetry={() => void pipeline.refetch()} />
            ) : null}
            {pipelineCounts ? (
              <div className="space-y-3" aria-label="Sales pipeline">
                {(
                  [
                    ['Companies', pipelineCounts.companies],
                    ['Leads', pipelineCounts.leads],
                    ['Prospects', pipelineCounts.prospects],
                    ['Proposals', pipelineCounts.proposals],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{label}</span>
                      <span className="tabular-nums">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" title={`${label}: ${value}`}>
                      <div
                        className="h-2 rounded-full bg-chart-1"
                        style={{ width: `${value === 0 ? 0 : (value / pipelineMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {pipelineCounts.companiesWithLeads} companies have leads,{' '}
                  {pipelineCounts.leadsWithProspects} leads have prospects,{' '}
                  {pipelineCounts.prospectsWithProposals} prospects have proposals. Each bar counts distinct records.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.isLoading ? <Skeleton className="h-28 w-full" /> : null}
            {tasks.isError ? (
              <DashboardSectionError error={tasks.error} onRetry={() => void tasks.refetch()} />
            ) : null}
            {taskCounts ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Pending</dt><dd className="text-2xl font-semibold tabular-nums">{taskCounts.pending}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Completed</dt><dd className="text-2xl font-semibold tabular-nums">{taskCounts.completed}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Overdue</dt><dd className="text-2xl font-semibold tabular-nums">{taskCounts.overdue}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Due today</dt><dd className="text-2xl font-semibold tabular-nums">{taskCounts.dueToday}</dd></div>
                <div className="rounded-lg border p-3 sm:col-span-2"><dt className="text-muted-foreground">Due this week (UTC)</dt><dd className="text-2xl font-semibold tabular-nums">{taskCounts.dueThisWeek}</dd></div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposal status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {counts.isLoading ? <Skeleton className="h-28 w-full" /> : null}
            {proposalParts.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="w-24">{label}</span>
                <div className="h-2 flex-1 rounded-full bg-muted" title={`${label}: ${value}`}>
                  <div className="h-2 rounded-full bg-chart-2" style={{ width: `${value === 0 ? 0 : (value / proposalMax) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? <Skeleton className="h-28 w-full" /> : null}
            {activity.isError ? (
              <DashboardSectionError error={activity.error} onRetry={() => void activity.refetch()} />
            ) : null}
            {activity.data && activity.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : null}
            <ul className="space-y-3">
              {activity.data?.items.map((item) => (
                <li key={`${item.kind}:${item.id}`} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{ACTIVITY_LABELS[item.kind] ?? item.kind}</p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.occurredAt}>
                    {formatWhen(item.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {communications.isError ? (
            <DashboardSectionError error={communications.error} onRetry={() => void communications.refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardKpiCard title="Email" value={communicationCounts?.emailConversations} description="Email conversations" icon={Send} href="/communication-hub" isLoading={communications.isLoading} />
              <DashboardKpiCard title="SMS" value={communicationCounts?.smsConversations} description="SMS conversations" icon={Send} href="/communication-hub" isLoading={communications.isLoading} />
              <DashboardKpiCard title="Calls" value={communicationCounts?.callConversations} description="Call conversations" icon={Phone} href="/communication-hub" isLoading={communications.isLoading} />
              <DashboardKpiCard title="All channels" value={communicationCounts?.totalConversations} description="Same records as Communication Hub" icon={Phone} href="/communication-hub" isLoading={communications.isLoading} />
            </div>
          )}
          {communications.data && communications.data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent communications.</p>
          ) : (
            <ul className="space-y-2">
              {communications.data?.recent.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize">{item.channel}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title || 'Untitled conversation'}</span>
                  <time className="text-xs text-muted-foreground" dateTime={item.updatedAt}>{formatWhen(item.updatedAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
