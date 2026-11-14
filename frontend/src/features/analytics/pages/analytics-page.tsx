import { useState } from 'react'
import { BarChart3, FileText, MessagesSquare, Users } from 'lucide-react'

import { DashboardKpiCard } from '@/features/dashboard/components/dashboard-kpi-card'
import { DashboardSectionError } from '@/features/dashboard/components/dashboard-section-error'
import { useAnalytics } from '@/features/analytics/hooks/use-analytics'
import type { AnalyticsComparison, AnalyticsQuery, AnalyticsRange } from '@/features/analytics/types/analytics.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES: Array<{ id: AnalyticsRange | '30d'; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
]

function comparisonText(comparison: AnalyticsComparison | undefined): string {
  if (!comparison) return ''
  if (comparison.previous === null || comparison.percentChange === null) {
    return `${comparison.current} in this period. Previous ${comparison.previous ?? 0}. Percent change is unavailable.`
  }
  const sign = comparison.percentChange > 0 ? '+' : ''
  return `${comparison.current} vs ${comparison.previous} previous (${sign}${comparison.percentChange}%, ${comparison.direction}).`
}

export function AnalyticsPage() {
  const [query, setQuery] = useState<AnalyticsQuery>({ range: '30d' })
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const data = useAnalytics(query)
  const sales = data.sales.data
  const proposals = data.proposals.data
  const tasks = data.tasks.data
  const team = data.team.data
  const communications = data.communications.data
  const trends = data.trends.data
  const insights = data.insights.data?.insights ?? []
  const empty = sales && sales.pipeline.companies + sales.pipeline.leads + sales.pipeline.prospects + sales.pipeline.proposals === 0 && (tasks?.status.pending ?? 0) === 0 && (tasks?.status.completed ?? 0) === 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6" data-testid="analytics-page">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Advanced analytics</h1>
        <p className="text-sm text-muted-foreground">
          Period totals are compared with the preceding period of the same length. Lifetime dashboard totals stay on the home dashboard.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Analytics date range">
          {RANGES.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={query.range === option.id ? 'default' : 'outline'}
              aria-pressed={query.range === option.id}
              onClick={() => setQuery({ range: option.id })}
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
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm text-foreground" />
          </label>
          <Button type="submit" size="sm" variant="outline">Apply range</Button>
        </form>
      </header>

      {data.sales.isError ? <DashboardSectionError error={data.sales.error} onRetry={() => void data.sales.refetch()} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="analytics-kpis">
        <DashboardKpiCard title="New companies" value={sales?.pipeline.companies} description={comparisonText(sales?.comparisons.companies)} icon={BarChart3} isLoading={data.sales.isLoading} />
        <DashboardKpiCard title="New leads" value={sales?.pipeline.leads} description={comparisonText(sales?.comparisons.leads)} icon={Users} isLoading={data.sales.isLoading} />
        <DashboardKpiCard title="Accepted proposals" value={proposals?.currentStatusEvents.accepted} description={proposals?.acceptanceRate.percent === null ? 'Acceptance rate unavailable' : `${proposals?.acceptanceRate.percent}% acceptance`} icon={FileText} isLoading={data.proposals.isLoading} />
        <DashboardKpiCard title="Overdue tasks" value={tasks?.status.overdue} description={comparisonText(tasks?.comparisons.overdue)} icon={BarChart3} isLoading={data.tasks.isLoading} />
      </section>

      {empty ? <p className="text-sm text-muted-foreground">No records were created in this period.</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales and CRM</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.sales.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {sales ? (
              <>
                <Bar label="Companies" value={sales.pipeline.companies} max={Math.max(sales.pipeline.companies, sales.pipeline.leads, sales.pipeline.prospects, 1)} />
                <Bar label="Leads" value={sales.pipeline.leads} max={Math.max(sales.pipeline.companies, sales.pipeline.leads, sales.pipeline.prospects, 1)} />
                <Bar label="Prospects" value={sales.pipeline.prospects} max={Math.max(sales.pipeline.companies, sales.pipeline.leads, sales.pipeline.prospects, 1)} />
                <p>{sales.leadToProspect.percent === null ? 'Lead-to-prospect rate unavailable.' : `Lead-to-prospect ${sales.leadToProspect.percent}% (${sales.leadToProspect.numerator} of ${sales.leadToProspect.denominator}).`}</p>
                <p className="text-muted-foreground">{sales.note}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Proposal performance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.proposals.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {data.proposals.isError ? <DashboardSectionError error={data.proposals.error} onRetry={() => void data.proposals.refetch()} /> : null}
            {proposals ? (
              <>
                <p>Sent {proposals.currentStatusEvents.sent}. Viewed {proposals.currentStatusEvents.viewed}. Accepted {proposals.currentStatusEvents.accepted}. Rejected {proposals.currentStatusEvents.rejected}.</p>
                <p>Draft {proposals.currentStatusEvents.draft}. Expired {proposals.currentStatusEvents.expired}. Cancelled {proposals.currentStatusEvents.cancelled}.</p>
                <p>{comparisonText(proposals.comparisons.accepted)}</p>
                <p className="text-muted-foreground">{proposals.note}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.tasks.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {data.tasks.isError ? <DashboardSectionError error={data.tasks.error} onRetry={() => void data.tasks.refetch()} /> : null}
            {tasks ? (
              <>
                <p>Pending {tasks.status.pending}. In progress {tasks.status.inProgress}. Completed {tasks.status.completed}. Cancelled {tasks.status.cancelled}. Overdue {tasks.status.overdue}.</p>
                <p>{tasks.completionRate.percent === null ? 'Completion rate unavailable.' : `Completion rate ${tasks.completionRate.percent}%.`}</p>
                <p className="text-muted-foreground">{tasks.note}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Team workload</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.team.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {data.team.isError ? <DashboardSectionError error={data.team.error} onRetry={() => void data.team.refetch()} /> : null}
            {team && team.members.length === 0 ? <p>No active team members.</p> : null}
            {team?.members.map((member) => (
              <p key={member.employeeId}>{member.name}: {member.open} open, {member.completed} completed, {member.overdue} overdue.</p>
            ))}
            {team ? <p className="text-muted-foreground">{team.note}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Communications</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.communications.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {data.communications.isError ? <DashboardSectionError error={data.communications.error} onRetry={() => void data.communications.refetch()} /> : null}
            {communications ? (
              <>
                <p className="flex items-center gap-2"><MessagesSquare className="size-4" /> {communications.conversations.totalConversations} conversations.</p>
                <p>Email {communications.conversations.emailConversations}. SMS {communications.conversations.smsConversations}. Calls {communications.conversations.callConversations}. Web {communications.conversations.webConversations}. Other channels {Math.max(0, communications.conversations.totalConversations - communications.conversations.emailConversations - communications.conversations.smsConversations - communications.conversations.callConversations - communications.conversations.webConversations)}.</p>
                <p>{comparisonText(communications.comparisons.total)}</p>
                <p className="text-muted-foreground">{communications.note}</p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.trends.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {data.trends.isError ? <DashboardSectionError error={data.trends.error} onRetry={() => void data.trends.refetch()} /> : null}
            {trends ? trends.leads.map((point) => <Bar key={point.day} label={point.day} value={point.count} max={Math.max(...trends.leads.map((item) => item.count), 1)} />) : null}
            {trends && trends.leads.length === 0 ? <p>No lead creation days in this period.</p> : null}
            {trends ? <p className="text-muted-foreground">{trends.note}</p> : null}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3" data-testid="analytics-insights">
        <h2 className="text-lg font-semibold">Business insights</h2>
        {data.insights.isLoading ? <Skeleton className="h-20 w-full" /> : null}
        {data.insights.isError ? <DashboardSectionError error={data.insights.error} onRetry={() => void data.insights.refetch()} /> : null}
        {insights.length === 0 && !data.insights.isLoading ? <p className="text-sm text-muted-foreground">No insight was calculated for this period.</p> : null}
        {insights.map((item) => (
          <Card key={item.insightId}>
            <CardHeader><CardTitle className="text-base">{item.title}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{item.description}</p>
              <p className="text-muted-foreground">{item.kind === 'recommendation' ? 'Recommendation' : 'Fact'}: {item.recommendation}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{value}</span></div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
