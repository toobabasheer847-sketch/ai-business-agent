import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { usePermissions } from '@/features/authorization/use-permissions'
import { growthApi, type GrowthOpportunity } from '@/features/revenue-growth/api/growth.api'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'cross_sell', label: 'Cross-sell' },
  { id: 'upsell', label: 'Upsell' },
  { id: 'customer_expansion', label: 'Expansion' },
  { id: 'lead_conversion', label: 'Lead review' },
  { id: 'stalled_sales', label: 'Stalled' },
  { id: 're_engagement', label: 'Re-engagement' },
  { id: 'proposal_follow_up', label: 'Proposal follow-up' },
  { id: 'customer_requested_service', label: 'Requested service' },
] as const

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export function GrowthOpportunitiesPage() {
  const { user } = useAuth()
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['analytics.view'])
  const queryClient = useQueryClient()
  const [type, setType] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [objective, setObjective] = useState('')
  const [planOutcome, setPlanOutcome] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const analytics = useQuery({ queryKey: ['growth', 'analytics'], queryFn: growthApi.analytics, enabled: allowed })
  const list = useQuery({ queryKey: ['growth', 'list', type], queryFn: () => growthApi.list(type || undefined), enabled: allowed })
  const detail = useQuery({ queryKey: ['growth', 'detail', selectedId], queryFn: () => growthApi.detail(selectedId!), enabled: allowed && Boolean(selectedId) })
  const refresh = useMutation({
    mutationFn: growthApi.refresh,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })
  const status = useMutation({
    mutationFn: (next: string) => growthApi.updateStatus(selectedId!, next, outcome || undefined),
    onSuccess: async () => { setOutcome(''); await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })
  const assign = useMutation({
    mutationFn: () => growthApi.assign(selectedId!, user?.id ?? ''),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })
  const task = useMutation({
    mutationFn: () => growthApi.createTask(selectedId!),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })
  const plan = useMutation({
    mutationFn: () => growthApi.createPlan({ opportunityId: selectedId!, objective, expectedOutcome: 'A person reviews the stored evidence and records what happened.' }),
    onSuccess: async () => { setObjective(''); await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })
  const draft = useMutation({
    mutationFn: () => growthApi.draft(selectedId!),
    onSuccess: (result) => setDraftBody(result.body),
  })
  const completePlan = useMutation({
    mutationFn: (id: string) => growthApi.completePlan(id, planOutcome),
    onSuccess: async () => { setPlanOutcome(''); await queryClient.invalidateQueries({ queryKey: ['growth'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <EmptyState title="Growth opportunities are limited to managers" description="Your role cannot view tenant-wide sales records." />

  const rows = list.data?.data ?? []
  const selected = detail.data?.opportunity

  function changeStatus(next: string, opportunity: GrowthOpportunity) {
    const needsConfirm = ['dismissed', 'lost', 'won', 'closed', 'converted'].includes(next)
    if (needsConfirm && !window.confirm(`Record ${label(next)} for ${opportunity.title}? This uses the outcome you entered.`)) return
    status.mutate(next)
  }

  return (
    <div className="space-y-6" data-testid="growth-opportunities-page">
      <PageHeader
        title="Growth opportunities"
        description="Evidence from stored leads, proposals, and messages. Priority is a review rank, not revenue."
        actions={<Button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending}>Review stored records</Button>}
      />
      {refresh.isError ? <p className="text-sm text-destructive">The review could not be saved. No opportunity was invented.</p> : null}
      {analytics.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {analytics.isError ? <p className="text-sm text-destructive">Growth counts could not be loaded.</p> : null}
      {analytics.data ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-base">Opportunities</CardTitle></CardHeader><CardContent>{analytics.data.total}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Awaiting review</CardTitle></CardHeader><CardContent>{analytics.data.awaitingReview}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">High priority</CardTitle></CardHeader><CardContent>{analytics.data.highPriority}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Overdue tasks</CardTitle></CardHeader><CardContent>{analytics.data.overdueLinked}</CardContent></Card>
        </div>
      ) : null}
      {analytics.data ? (
        <p className="text-sm text-muted-foreground">
          Stalled {analytics.data.byType.stalled_sales ?? 0}. Re-engagement {analytics.data.byType.re_engagement ?? 0}. Statuses {Object.entries(analytics.data.byStatus).map(([status, count]) => `${label(status)} ${count}`).join(', ') || 'none'}. Categories {Object.entries(analytics.data.byType).map(([type, count]) => `${label(type)} ${count}`).join(', ') || 'none'}. Priorities {Object.entries(analytics.data.byPriority).map(([priority, count]) => `${label(priority)} ${count}`).join(', ') || 'none'}.
        </p>
      ) : null}
      {analytics.data ? <p className="text-sm text-muted-foreground">{analytics.data.note} {analytics.data.scoring} Revenue is {analytics.data.revenue === null ? 'not calculated' : 'unavailable'}.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Opportunity list</CardTitle>
          <CardDescription>Each row cites a stored record. A quiet lead is not a lost sale.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <Button key={filter.id || 'all'} type="button" variant={type === filter.id ? 'default' : 'outline'} onClick={() => setType(filter.id)}>{filter.label}</Button>
            ))}
          </div>
          {list.isLoading ? <Skeleton className="h-20 w-full" /> : null}
          {list.isError ? <p className="text-sm text-destructive">Opportunities could not be loaded.</p> : null}
          {!list.isLoading && rows.length === 0 ? <EmptyState title="No stored opportunities" description="Review stored records to look for explicit requests, quiet leads, and proposal follow-ups." /> : null}
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className="w-full rounded-md border p-3 text-left" onClick={() => { setSelectedId(row.id); setDraftBody('') }}>
                  <span className="font-medium">{row.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{row.companyName}{row.leadId ? ` · lead ${row.leadId}` : ''} · {label(row.opportunityType)} · {label(row.priority)} priority · confidence {row.confidence} · {label(row.status)}</span>
                  <span className="mt-1 block text-sm">{row.evidence}</span>
                  <span className="mt-1 block text-sm">{row.recommendedAction}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{row.assignedTo ? `Owner ${row.assignedTo}` : 'Unassigned'} · {new Date(row.createdAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{selected.title}</CardTitle>
            <CardDescription>{selected.companyName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{selected.description}</p>
            <p><span className="font-medium">Evidence. </span>{selected.evidence}</p>
            <p><span className="font-medium">Recommended action. </span>{selected.recommendedAction}</p>
            <p>Confidence {selected.confidence}. Priority source {label(selected.prioritySource)}. Rank {selected.priorityRank} is not a revenue amount.</p>
            <div className="flex flex-wrap gap-2">
              <Badge>{label(selected.status)}</Badge>
              <Badge variant="outline">{selected.explicit ? 'Explicit request' : 'Inferred from inactivity or proposal state'}</Badge>
            </div>
            <p className="text-muted-foreground">Source {selected.sourceType} {selected.sourceId}{selected.leadId ? ` · lead ${selected.leadId}` : ''}{selected.proposalId ? ` · proposal ${selected.proposalId}` : ''}</p>
            {detail.data?.events.length ? (
              <ul className="space-y-1">
                {detail.data.events.map((event) => <li key={event.id}>{event.fromStatus ?? 'new'} → {event.toStatus}: {event.note}</li>)}
              </ul>
            ) : null}
            {detail.data?.plans.map((item) => (
              <div key={item.id} className="space-y-2 rounded-md border p-3">
                <p>Plan: {item.objective} ({label(item.status)}){item.actualOutcome ? ` · ${item.actualOutcome}` : ''}</p>
                {item.status === 'open' ? (
                  <>
                    <label className="block space-y-1">
                      <span>Actual outcome</span>
                      <Input aria-label="Actual outcome" value={planOutcome} onChange={(event) => setPlanOutcome(event.target.value)} maxLength={500} />
                    </label>
                    <Button type="button" disabled={planOutcome.trim().length < 3 || completePlan.isPending} onClick={() => completePlan.mutate(item.id)}>Record plan outcome</Button>
                  </>
                ) : null}
              </div>
            ))}
            <label className="block space-y-1">
              <span>Outcome</span>
              <Input value={outcome} onChange={(event) => setOutcome(event.target.value)} maxLength={500} />
            </label>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'identified' ? <Button type="button" onClick={() => changeStatus('needs_review', selected)}>Review</Button> : null}
              {selected.status === 'needs_review' ? <Button type="button" onClick={() => changeStatus('qualified', selected)}>Qualify</Button> : null}
              {selected.status === 'qualified' ? (
                <>
                  <Input aria-label="Action objective" value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={500} placeholder="Objective" />
                  <Button type="button" disabled={objective.trim().length < 3 || plan.isPending} onClick={() => plan.mutate()}>Create action plan</Button>
                </>
              ) : null}
              <Button type="button" variant="outline" disabled={!user?.id || assign.isPending} onClick={() => assign.mutate()}>Assign to me</Button>
              <Button type="button" variant="outline" disabled={task.isPending} onClick={() => task.mutate()}>Create task</Button>
              <Button type="button" variant="outline" disabled={draft.isPending} onClick={() => draft.mutate()}>Draft follow-up</Button>
              {['identified', 'needs_review', 'qualified', 'action_planned', 'in_progress'].includes(selected.status) ? (
                <Button type="button" variant="outline" onClick={() => changeStatus('dismissed', selected)}>Dismiss</Button>
              ) : null}
              {selected.status === 'in_progress' ? <Button type="button" variant="outline" onClick={() => changeStatus('lost', selected)}>Record lost</Button> : null}
            </div>
            {status.isError ? <p className="text-destructive">The status was not changed. Won and converted require an existing CRM record, and lost requires an outcome.</p> : null}
            {draftBody ? <pre className="whitespace-pre-wrap rounded-md bg-muted p-3">{draftBody}</pre> : null}
            {draftBody ? <p className="text-muted-foreground">This draft has not been sent.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
