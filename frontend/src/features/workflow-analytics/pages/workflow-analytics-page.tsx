import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/authorization/use-permissions'
import { workflowAnalyticsApi, type AnalyticsParams } from '@/features/workflow-analytics/api/workflow-analytics.api'
import type { SavingsEstimate, WorkflowTrendDay } from '@/features/workflow-analytics/types/workflow-analytics.types'

const RANGES = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
] as const

export function WorkflowAnalyticsPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['workflow.manage'])
  const [range, setRange] = useState<AnalyticsParams['range']>('30d')
  const [workflowStatus, setWorkflowStatus] = useState('')
  const params: AnalyticsParams = { range, workflowStatus: workflowStatus || undefined }
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['workflow-analytics', 'overview', params], queryFn: () => workflowAnalyticsApi.overview(params), enabled: allowed })
  const trends = useQuery({ queryKey: ['workflow-analytics', 'trends', params], queryFn: () => workflowAnalyticsApi.trends(params), enabled: allowed })
  const workflows = useQuery({ queryKey: ['workflow-analytics', 'workflows', params], queryFn: () => workflowAnalyticsApi.workflows(params), enabled: allowed })
  const failures = useQuery({ queryKey: ['workflow-analytics', 'failures', params], queryFn: () => workflowAnalyticsApi.failures(params), enabled: allowed })
  const optimizations = useQuery({ queryKey: ['workflow-analytics', 'optimizations', params], queryFn: () => workflowAnalyticsApi.optimizations(params), enabled: allowed })
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => workflowAnalyticsApi.updateStatus(id, status),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['workflow-analytics', 'optimizations'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Workflow analytics" description="Performance of this tenant's workflows." />
        <EmptyState title="Workflow analytics are limited to managers" description="Owner and admin roles can review workflow performance." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow analytics" description="Rates and durations come from execution records. Time saved and AI cost are estimates when the underlying data exists." />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Date range</span>
          <select aria-label="Date range" className="h-9 rounded-md border bg-background px-2" value={range} onChange={(event) => setRange(event.target.value)}>
            {RANGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Workflow status</span>
          <select aria-label="Workflow status" className="h-9 rounded-md border bg-background px-2" value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>
      {overview.isLoading ? <Skeleton className="h-28 w-full" data-testid="analytics-loading" /> : null}
      {overview.isError ? <EmptyState title="Workflow analytics are unavailable" action={<Button onClick={() => overview.refetch()}>Retry</Button>} /> : null}
      {overview.data && overview.data.executions.total === 0 && overview.data.workflows.total === 0 ? <EmptyState title="No workflow activity" description="Analytics appear after this tenant saves a workflow or records an execution." /> : null}
      {overview.data ? <Overview data={overview.data} /> : null}
      {trends.data ? <TrendChart days={trends.data.days} /> : null}
      {workflows.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {workflows.data ? <PerformanceTable rows={workflows.data.data} /> : null}
      {failures.data ? <FailurePanel report={failures.data} /> : null}
      {optimizations.data ? <RecommendationList rows={optimizations.data.data} pending={updateStatus.isPending} onStatus={(id, status) => updateStatus.mutate({ id, status })} /> : null}
    </div>
  )
}

function Overview({ data }: { data: { workflows: { active: number }; executions: { total: number }; rates: { successRate: number | null; failureRate: number | null }; duration: { averageMs: number | null }; savings: { label: string; estimatedSeconds: number | null; status: string; baselineSource: string; today: SavingsEstimate; week: SavingsEstimate; month: SavingsEstimate }; ai: { estimatedCost: string | null; currency: string | null; totalRuns: number; note: string; pricingNotConfiguredRuns: number }; health: { healthy: number; needsAttention: number; unhealthy: number; insufficientData: number } } }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Executions" value={String(data.executions.total)} />
        <Metric label="Success rate" value={data.rates.successRate === null ? 'Not enough data' : `${data.rates.successRate}%`} />
        <Metric label="Failure rate" value={data.rates.failureRate === null ? 'Not enough data' : `${data.rates.failureRate}%`} />
        <Metric label="Average duration" value={data.duration.averageMs === null ? 'Not enough data' : formatDuration(data.duration.averageMs)} />
        <Metric label="Estimated time saved" value={formatSavings(data.savings)} />
        <Metric label="AI estimated cost" value={data.ai.totalRuns === 0 ? 'No generation calls' : data.ai.estimatedCost ? `${data.ai.estimatedCost} ${data.ai.currency ?? ''}`.trim() : 'Pricing unavailable'} />
      </div>
      <p className="text-sm text-muted-foreground">{data.savings.label} Baseline: {data.savings.baselineSource}. Today {formatSavings(data.savings.today)}, this week {formatSavings(data.savings.week)}, this month {formatSavings(data.savings.month)}.</p>
      <p className="text-sm text-muted-foreground">{data.ai.note}{data.ai.pricingNotConfiguredRuns > 0 ? ` ${data.ai.pricingNotConfiguredRuns} runs have no configured price.` : ''}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{data.health.healthy} healthy</Badge>
        <Badge variant="outline">{data.health.needsAttention} need attention</Badge>
        <Badge variant="outline">{data.health.unhealthy} unhealthy</Badge>
        <Badge variant="outline">{data.health.insufficientData} insufficient data</Badge>
        <span className="text-muted-foreground">{data.workflows.active} active workflows</span>
      </div>
    </div>
  )
}

function TrendChart({ days }: { days: WorkflowTrendDay[] }) {
  const max = Math.max(1, ...days.map((day) => day.executions))
  if (days.length === 0) return <EmptyState title="No trend days" description="Choose a date range to plot execution volume." />
  return (
    <Card>
      <CardHeader><CardTitle>Execution volume</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {days.map((day) => (
          <div key={day.day} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
            <span>{day.day}</span>
            <div className="h-2 rounded bg-muted" aria-label={`${day.day}: ${day.completed} completed, ${day.failed} failed`}>
              <div className="h-2 rounded bg-foreground/70" style={{ width: `${Math.round((day.executions / max) * 100)}%` }} />
            </div>
            <span className="tabular-nums text-muted-foreground">{day.completed} ok / {day.failed} failed</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PerformanceTable({ rows }: { rows: Array<{ id: string; name: string; status: string; executions: number; successRate: number | null; failureRate: number | null; averageDurationMs: number | null; healthScore: number | null; healthLabel: string; lastExecutionAt: string | null }> }) {
  if (rows.length === 0) return <EmptyState title="No workflows in this filter" />
  return (
    <Card>
      <CardHeader><CardTitle>Workflow performance</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Workflow</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Executions</th>
              <th className="py-2 pr-3 font-medium">Success</th>
              <th className="py-2 pr-3 font-medium">Failure</th>
              <th className="py-2 pr-3 font-medium">Average</th>
              <th className="py-2 pr-3 font-medium">Health</th>
              <th className="py-2 font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="py-2 pr-3"><Link className="underline" to={`/workflows`}>{row.name}</Link></td>
                <td className="py-2 pr-3">{row.status}</td>
                <td className="py-2 pr-3 tabular-nums">{row.executions}</td>
                <td className="py-2 pr-3">{row.successRate === null ? 'Not enough data' : `${row.successRate}%`}</td>
                <td className="py-2 pr-3">{row.failureRate === null ? 'Not enough data' : `${row.failureRate}%`}</td>
                <td className="py-2 pr-3">{row.averageDurationMs === null ? 'Not enough data' : formatDuration(row.averageDurationMs)}</td>
                <td className="py-2 pr-3">{row.healthLabel}{row.healthScore === null ? '' : ` ${row.healthScore}`}</td>
                <td className="py-2">{row.lastExecutionAt ? new Date(row.lastExecutionAt).toLocaleString() : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function FailurePanel({ report }: { report: { categories: Array<{ errorCode: string; count: number }>; actions: Array<{ actionType: string; failed: number }>; recent: Array<{ executionId: string; workflowName: string; sanitizedError: string | null }> } }) {
  if (report.categories.length === 0 && report.recent.length === 0) return <EmptyState title="No failed executions in this range" />
  return (
    <Card>
      <CardHeader><CardTitle>Failures</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {report.categories.map((item) => <p key={item.errorCode}>{item.errorCode}: {item.count}</p>)}
        {report.actions.map((item) => <p key={item.actionType}>{item.actionType} failed {item.failed} times</p>)}
        {report.recent.map((item) => <p key={item.executionId}>{item.workflowName}: {item.sanitizedError ?? item.executionId}</p>)}
      </CardContent>
    </Card>
  )
}

function RecommendationList({ rows, pending, onStatus }: { rows: Array<{ id: string; title: string; evidence: string; suggestion: string; impact: string; workflowName: string | null; status: string }>; pending: boolean; onStatus: (id: string, status: string) => void }) {
  if (rows.length === 0) return <EmptyState title="No optimization recommendations" description="Recommendations appear when repeated failures, slow steps, approval waits, unused workflows, or retries meet the evidence thresholds." />
  return (
    <Card>
      <CardHeader><CardTitle>Optimization recommendations</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <article key={row.id} className="space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{row.title}</h3>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p>{row.evidence}</p>
            <p className="text-muted-foreground">Suggestion: {row.suggestion}</p>
            <p className="text-muted-foreground">Impact: {row.impact}{row.workflowName ? ` Workflow: ${row.workflowName}.` : ''}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onStatus(row.id, 'reviewed')}>Mark reviewed</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onStatus(row.id, 'dismissed')}>Dismiss</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onStatus(row.id, 'applied')}>Mark applied</Button>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${Math.round(ms / 100) / 10} s`
}

function formatSavings(savings: { status: string; estimatedSeconds: number | null }) {
  if (savings.status !== 'estimated' || savings.estimatedSeconds === null) return 'Not enough data'
  const minutes = Math.round(savings.estimatedSeconds / 60)
  return `About ${minutes} min`
}
