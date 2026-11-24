import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { businessIntelligenceApi, type BusinessParams } from '@/features/business-intelligence/api/business-intelligence.api'
import { usePermissions } from '@/features/authorization/use-permissions'

const RANGES = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
] as const

export function BusinessIntelligencePage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['analytics.view'])
  const [range, setRange] = useState<string>('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [horizon, setHorizon] = useState('7')
  const params: BusinessParams = {
    range,
    horizon,
    from: range === 'custom' ? from : undefined,
    to: range === 'custom' ? to : undefined,
  }
  const enabled = allowed && (range !== 'custom' || Boolean(from && to))
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['business-intelligence', 'overview', params], queryFn: () => businessIntelligenceApi.overview(params), enabled })
  const sales = useQuery({ queryKey: ['business-intelligence', 'sales', params], queryFn: () => businessIntelligenceApi.salesForecast(params), enabled })
  const leads = useQuery({ queryKey: ['business-intelligence', 'leads', params], queryFn: () => businessIntelligenceApi.leadInsights(params), enabled })
  const pipeline = useQuery({ queryKey: ['business-intelligence', 'pipeline', params], queryFn: () => businessIntelligenceApi.revenuePipeline(params), enabled })
  const workload = useQuery({ queryKey: ['business-intelligence', 'workload', params], queryFn: () => businessIntelligenceApi.workloadForecast(params), enabled })
  const risks = useQuery({ queryKey: ['business-intelligence', 'risks', params], queryFn: () => businessIntelligenceApi.risks(params), enabled })
  const insights = useQuery({ queryKey: ['business-intelligence', 'insights', params], queryFn: () => businessIntelligenceApi.insights(params), enabled })
  const refresh = useMutation({
    mutationFn: () => businessIntelligenceApi.refresh(params),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['business-intelligence'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <EmptyState title="Business intelligence is limited to managers" description="Your role can view your own analytics, not tenant-wide forecasts." />

  const history = overview.data?.history
  const accepted = overview.data?.pipeline[0]
  return (
    <div className="space-y-6">
      <PageHeader
        title="Business intelligence"
        description="Historical records, estimates, and suggestions stay separate. Dates are UTC."
        actions={<Button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending || !enabled}>Refresh forecasts</Button>}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Period
          <select className="mt-1 block rounded-md border bg-background px-2 py-1" value={range} onChange={(event) => setRange(event.target.value)}>
            {RANGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {range === 'custom' ? (
          <>
            <label className="text-sm">From<input className="mt-1 block rounded-md border bg-background px-2 py-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="text-sm">To<input className="mt-1 block rounded-md border bg-background px-2 py-1" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </>
        ) : null}
        <label className="text-sm">
          Forecast horizon
          <select className="mt-1 block rounded-md border bg-background px-2 py-1" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
      </div>
      {overview.isLoading ? <Skeleton className="h-28 w-full" /> : null}
      {overview.isError ? <EmptyState title="Business intelligence could not be loaded" action={<Button type="button" onClick={() => overview.refetch()}>Retry</Button>} /> : null}
      {history ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Leads created" value={String(history.leadsCreated)} detail={`Previous period ${history.previousLeads}`} />
          <Metric label="Proposal acceptance" value={history.acceptance.rate === null ? 'Not enough data' : `${history.acceptance.rate}%`} detail={`${history.acceptance.decided} decisions`} />
          <Metric label="Accepted proposal value" value={accepted ? `${accepted.currency} ${accepted.accepted}` : 'No proposals'} detail="Not recognized revenue" />
          <Metric label="Pending pipeline" value={accepted ? `${accepted.currency} ${accepted.pending}` : 'No proposals'} detail="Sent or viewed only" />
          <Metric label="Overdue tasks" value={String(overview.data?.workload.overdue ?? 0)} detail="Current open tasks" />
          <Metric label="Open risks" value={String(overview.data?.risks.length ?? 0)} detail={overview.data?.classification.forecasts ?? ''} />
        </section>
      ) : null}
      <Section title="Sales forecast" loading={sales.isLoading} error={sales.isError} onRetry={() => sales.refetch()} empty={sales.data?.forecasts.length === 0}>
        <div className="grid gap-3 md:grid-cols-2">
          {sales.data?.forecasts.map((forecast) => (
            <Card key={forecast.metric}>
              <CardHeader><CardTitle className="text-base">{forecast.metric.replaceAll('_', ' ')}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{forecast.status === 'forecast' ? `Estimate ${forecast.predicted} (range ${forecast.lower} to ${forecast.upper})` : 'INSUFFICIENT_DATA'}</p>
                <p>Confidence {forecast.confidence}. Method {forecast.method ?? 'not used'}.</p>
                <p>{forecast.weeks} weekly buckets and {forecast.observations} observations.</p>
                {forecast.holdout ? <p>Historical holdout error {forecast.holdout.absoluteError}. This is a backtest, not proof of future accuracy.</p> : null}
                {forecast.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Revenue pipeline" loading={pipeline.isLoading} error={pipeline.isError} onRetry={() => pipeline.refetch()} empty={pipeline.data?.pipeline.length === 0}>
        <p className="text-sm text-muted-foreground">{pipeline.data?.note}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {pipeline.data?.pipeline.map((bucket) => (
            <Card key={bucket.currency}>
              <CardHeader><CardTitle className="text-base">{bucket.currency}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Accepted proposal value {bucket.accepted} across {bucket.acceptedCount} proposals.</p>
                <p>Pending pipeline {bucket.pending} across {bucket.pendingCount} proposals.</p>
                <p>Rejected proposal value {bucket.rejected} across {bucket.rejectedCount} proposals.</p>
                <p>{bucket.forecastStatus === 'estimated' ? `Forecasted potential ${bucket.forecastPotential}. This is an estimate.` : 'Forecasted potential is INSUFFICIENT_DATA.'}</p>
                {bucket.missingPrice > 0 ? <p>{bucket.missingPrice} proposals have no price and were left out of the sums.</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Lead intelligence" loading={leads.isLoading} error={leads.isError} onRetry={() => leads.refetch()}>
        {leads.data ? (
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              <p>{leads.data.conversion.explanation}</p>
              <p>{leads.data.conversion.converted} converted, {leads.data.conversion.lost} lost, {leads.data.conversion.open} still open, from {leads.data.conversion.created} leads created in the period.</p>
              <p>Individual lead probabilities are not shown.</p>
              {leads.data.conversion.pattern ? (
                <p>Leads with a recorded task converted at {leads.data.conversion.pattern.withTaskRate}%. Leads without one converted at {leads.data.conversion.pattern.withoutTaskRate}%. {leads.data.conversion.pattern.note}</p>
              ) : <p>A follow-up pattern is not shown because one of the groups has fewer than five completed outcomes.</p>}
            </CardContent>
          </Card>
        ) : null}
      </Section>
      <Section title="Workload" loading={workload.isLoading} error={workload.isError} onRetry={() => workload.refetch()}>
        {workload.data ? (
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              <p>{workload.data.workload.open} open tasks. {workload.data.workload.overdue} are overdue. {workload.data.workload.dueNext7Days} are due within seven days.</p>
              <p>{workload.data.workload.note}</p>
              <p>{workload.data.workload.completionForecast === 'available' ? 'A completion forecast is included in the sales forecast section.' : 'Completion history is INSUFFICIENT_DATA, so only the current workload is shown.'}</p>
              {workload.data.workload.busiest ? <p>{workload.data.workload.busiest.name} has {workload.data.workload.busiest.open} open tasks. That is assigned workload, not a performance rating.</p> : null}
              <ul>
                {workload.data.workload.users.map((user) => <li key={user.userId}>{user.name}: {user.open} open, {user.overdue} overdue</li>)}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </Section>
      <Section title="Business risks" loading={risks.isLoading} error={risks.isError} onRetry={() => risks.refetch()} empty={risks.data?.risks.length === 0} emptyTitle="No risk rule matched">
        <div className="grid gap-3">
          {risks.data?.risks.map((risk) => (
            <Card key={risk.key}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{risk.title}</CardTitle>
                <Badge>{risk.severity}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{risk.evidence}</p>
                <p>{risk.comparison}</p>
                <p>Suggested action: {risk.action}</p>
                <p>Confidence {risk.confidence}. {risk.predictive ? 'This is a possible upcoming issue, not a recorded failure.' : 'This describes the current records.'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Suggestions" loading={insights.isLoading} error={insights.isError} onRetry={() => insights.refetch()} empty={insights.data?.insights.length === 0} emptyTitle="No suggestion for this period">
        <p className="mb-3 text-sm text-muted-foreground">{insights.data?.note}</p>
        <div className="grid gap-3">
          {insights.data?.insights.map((insight) => (
            <Card key={insight.key}>
              <CardHeader><CardTitle className="text-base">{insight.title}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{insight.evidence}</p>
                <p>Suggestion: {insight.recommendation}</p>
                <p>Confidence {insight.confidence}. Category {insight.category}.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function Section({ title, loading, error, onRetry, empty, emptyTitle, children }: { title: string; loading: boolean; error: boolean; onRetry: () => void; empty?: boolean; emptyTitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {loading ? <Skeleton className="h-24 w-full" /> : null}
      {error ? <EmptyState title={`${title} could not be loaded`} action={<Button type="button" onClick={onRetry}>Retry</Button>} /> : null}
      {!loading && !error && empty ? <EmptyState title={emptyTitle ?? 'Nothing to show'} /> : null}
      {!loading && !error && !empty ? children : null}
    </section>
  )
}
