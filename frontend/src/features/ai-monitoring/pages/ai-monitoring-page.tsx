import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { aiMonitoringApi } from '@/features/ai-monitoring/api/ai-monitoring.api'
import { formatEstimatedCost, formatTokenCount } from '@/features/ai-monitoring/lib/format-cost'
import type { AgentRun, MonitoringFilters, MonitoringSummary } from '@/features/ai-monitoring/types/ai-monitoring.types'

const EMPTY_FILTERS: MonitoringFilters = { page: 1 }

export function AiMonitoringPage() {
  const [filters, setFilters] = useState<MonitoringFilters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const summary = useQuery({ queryKey: ['ai-monitoring', 'summary', filters], queryFn: () => aiMonitoringApi.summary(filters) })
  const runs = useQuery({ queryKey: ['ai-monitoring', 'runs', filters], queryFn: () => aiMonitoringApi.runs(filters) })
  const detail = useQuery({
    queryKey: ['ai-monitoring', 'run', selectedId],
    queryFn: () => aiMonitoringApi.run(selectedId as string),
    enabled: Boolean(selectedId),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Monitoring"
        description="Provider runs, reported token usage, and estimated cost for this workspace. Estimated cost is not a provider invoice."
      />
      <form
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault()
          setFilters({ ...draft, page: 1 })
        }}
      >
        <Input type="date" aria-label="From" value={draft.from ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        <Input type="date" aria-label="To" value={draft.to ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        <Input aria-label="Agent" placeholder="Agent" value={draft.agent ?? ''} onChange={(event) => setDraft({ ...draft, agent: event.target.value })} />
        <Input aria-label="Provider" placeholder="Provider" value={draft.provider ?? ''} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} />
        <Input aria-label="Model" placeholder="Model" value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
        <select
          aria-label="Status"
          className="h-9 rounded-lg border bg-background px-3 text-sm"
          value={draft.status ?? ''}
          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
        >
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <div className="flex gap-2 md:col-span-6">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS) }}>Clear</Button>
        </div>
      </form>

      {summary.isLoading ? <Skeleton className="h-28 w-full" /> : null}
      {summary.isError ? <ErrorState onRetry={() => summary.refetch()} /> : null}
      {summary.data ? <SummaryPanel summary={summary.data} /> : null}
      {runs.isLoading ? <Skeleton className="h-64 w-full" /> : null}
      {runs.isError ? <ErrorState onRetry={() => runs.refetch()} /> : null}
      {runs.data && runs.data.total === 0 ? (
        <EmptyState title="No AI runs yet" description="Runs appear after a provider request. Local fallbacks and specialist tools that do not call a model are not listed." />
      ) : null}
      {runs.data && runs.data.data.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Execution history</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Input tokens</TableHead>
                  <TableHead>Output tokens</TableHead>
                  <TableHead>Estimated cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.data.map((run) => (
                  <TableRow key={run.id} className="cursor-pointer" onClick={() => setSelectedId(run.id)}>
                    <TableCell className="font-mono text-xs">{run.providerExecutionId.slice(0, 8)}</TableCell>
                    <TableCell>{run.agentName}</TableCell>
                    <TableCell>{run.provider}</TableCell>
                    <TableCell>{run.model}</TableCell>
                    <TableCell><StatusBadge status={run.status} label={run.status} /></TableCell>
                    <TableCell>{formatTokenCount(run.inputTokens)}</TableCell>
                    <TableCell>{formatTokenCount(run.outputTokens)}</TableCell>
                    <TableCell>{runCost(run)}</TableCell>
                    <TableCell>{run.durationMs === null ? '—' : `${run.durationMs} ms`}</TableCell>
                    <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{runs.data.total} runs</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>Previous</Button>
                <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) * runs.data.limit >= runs.data.total} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Run details</DialogTitle></DialogHeader>
          {detail.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {detail.isError ? <ErrorState onRetry={() => detail.refetch()} /> : null}
          {detail.data ? <RunDetails run={detail.data} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryPanel({ summary }: { summary: MonitoringSummary }) {
  const maxDay = Math.max(1, ...summary.usageOverTime.map((item) => item.runs))
  const maxAgent = Math.max(1, ...summary.runsByAgent.map((item) => item.runs))
  const cards = [
    ['Total AI runs', String(summary.totalRuns)],
    ['Successful runs', String(summary.successfulRuns)],
    ['Failed runs', String(summary.failedRuns)],
    ['Input tokens', summary.totalRuns === 0 ? 'No data' : formatTokenCount(summary.inputTokens)],
    ['Output tokens', summary.totalRuns === 0 ? 'No data' : formatTokenCount(summary.outputTokens)],
    ['Estimated AI cost', formatEstimatedCost(summary)],
    ['Average duration', summary.averageDurationMs === null ? 'No data' : `${summary.averageDurationMs} ms`],
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
          </Card>
        ))}
      </div>
      {summary.usageUnavailableRuns > 0 ? <p className="text-sm text-muted-foreground">{summary.usageUnavailableRuns} runs did not include provider token counts.</p> : null}
      {summary.pricingNotConfiguredRuns > 0 ? <p className="text-sm text-muted-foreground">Pricing not configured for {summary.pricingNotConfiguredRuns} runs. Token counts are still shown when the provider reported them.</p> : null}
      {summary.totalRuns === 0 ? null : (
        <div className="grid gap-4 lg:grid-cols-2">
          <BarCard title="Usage over time" empty={summary.usageOverTime.length === 0} note={summary.usageOverTimeTruncated ? 'Showing the latest 366 days in this filter.' : undefined}>
            {summary.usageOverTime.map((item) => (
              <Bar key={item.day} label={item.day} width={(item.runs / maxDay) * 100} value={String(item.runs)} />
            ))}
          </BarCard>
          <BarCard title="Cost by model" empty={summary.costByModel.length === 0}>
            {summary.costByModel.map((item) => (
              <Bar
                key={`${item.provider}:${item.model}`}
                label={`${item.provider} / ${item.model}`}
                width={(item.runs / Math.max(1, ...summary.costByModel.map((row) => row.runs))) * 100}
                value={item.estimatedCost && item.currency ? `${trim(item.estimatedCost)} ${item.currency}` : 'Pricing not configured'}
              />
            ))}
          </BarCard>
          <BarCard title="Runs by agent" empty={summary.runsByAgent.length === 0}>
            {summary.runsByAgent.map((item) => (
              <Bar key={item.agent} label={item.agent} width={(item.runs / maxAgent) * 100} value={String(item.runs)} />
            ))}
          </BarCard>
          <BarCard title="Success and failure" empty={summary.totalRuns === 0}>
            <Bar label="Successful" width={(summary.successfulRuns / Math.max(1, summary.totalRuns)) * 100} value={String(summary.successfulRuns)} />
            <Bar label="Failed" width={(summary.failedRuns / Math.max(1, summary.totalRuns)) * 100} value={String(summary.failedRuns)} />
            <Bar label="Running" width={(summary.runningRuns / Math.max(1, summary.totalRuns)) * 100} value={String(summary.runningRuns)} />
          </BarCard>
        </div>
      )}
    </div>
  )
}

function BarCard({ title, empty, note, children }: { title: string; empty: boolean; note?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {empty ? <p className="text-sm text-muted-foreground">No data</p> : children}
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  )
}

function Bar({ label, width, value }: { label: string; width: number; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm"><span>{label}</span><span className="text-muted-foreground">{value}</span></div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-chart-1" style={{ width: `${Math.max(width, 0)}%` }} />
      </div>
    </div>
  )
}

function RunDetails({ run }: { run: AgentRun }) {
  const rows = [
    ['Execution ID', run.providerExecutionId],
    ['Correlation ID', run.correlationId],
    ['Parent run', run.parentRunId ?? 'None'],
    ['Agent', run.agentName],
    ['Provider', run.provider],
    ['Model', run.model],
    ['Status', run.status],
    ['Usage', run.usageStatus === 'reported' ? `${formatTokenCount(run.inputTokens)} in / ${formatTokenCount(run.outputTokens)} out / ${formatTokenCount(run.totalTokens)} total` : run.usageNote ?? 'Usage unavailable'],
    ['Cost', costDetail(run)],
    ['Duration', run.durationMs === null ? 'Not recorded' : `${run.durationMs} ms`],
    ['Started', new Date(run.startedAt).toLocaleString()],
    ['Completed', run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Not completed'],
    ['Error', run.errorSummary ? `${run.errorCode ?? 'Error'}: ${run.errorSummary}` : 'None'],
  ]
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState title="AI monitoring is unavailable" description="The monitoring request failed. Provider results are not affected." action={<Button type="button" onClick={onRetry}>Retry</Button>} />
  )
}

function runCost(run: AgentRun) {
  if (run.costStatus === 'estimated' && run.estimatedTotalCost && run.currency) return `${trim(run.estimatedTotalCost)} ${run.currency}`
  if (run.costStatus === 'pricing_not_configured') return 'Pricing not configured'
  return 'Usage unavailable'
}

function costDetail(run: AgentRun) {
  if (run.costStatus !== 'estimated') return run.costStatus === 'pricing_not_configured' ? 'Pricing not configured' : 'Usage unavailable'
  return `Estimated ${trim(run.estimatedTotalCost ?? '0')} ${run.currency ?? ''}. Input ${run.estimatedInputCost ?? 'unavailable'}, output ${run.estimatedOutputCost ?? 'unavailable'}. Source: ${run.pricingSource ?? 'not recorded'}${run.pricingEffectiveDate ? `, effective ${run.pricingEffectiveDate}` : ''}. This is not a provider invoice.`
}

function trim(value: string) {
  return value.replace(/0+$/, '').replace(/\.$/, '')
}
