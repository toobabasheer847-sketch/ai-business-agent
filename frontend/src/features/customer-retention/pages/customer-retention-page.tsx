import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/authorization/use-permissions'
import { customerRetentionApi, type RetentionAccount } from '@/features/customer-retention/api/customer-retention.api'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'attention_needed', label: 'Attention needed' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'insufficient_data', label: 'Insufficient data' },
] as const

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export function CustomerRetentionPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['analytics.view'])
  const queryClient = useQueryClient()
  const [classification, setClassification] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const analytics = useQuery({ queryKey: ['customer-retention', 'analytics'], queryFn: customerRetentionApi.analytics, enabled: allowed })
  const accounts = useQuery({ queryKey: ['customer-retention', 'accounts', classification], queryFn: () => customerRetentionApi.accounts(classification || undefined), enabled: allowed })
  const recommendations = useQuery({ queryKey: ['customer-retention', 'recommendations'], queryFn: customerRetentionApi.recommendations, enabled: allowed })
  const plans = useQuery({ queryKey: ['customer-retention', 'plans'], queryFn: customerRetentionApi.plans, enabled: allowed })
  const detail = useQuery({ queryKey: ['customer-retention', 'account', companyId], queryFn: () => customerRetentionApi.account(companyId!), enabled: allowed && Boolean(companyId) })
  const refresh = useMutation({
    mutationFn: customerRetentionApi.refresh,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customer-retention'] }) },
  })
  const followUp = useMutation({
    mutationFn: (id: string) => customerRetentionApi.createTask(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customer-retention'] }) },
  })
  const complete = useMutation({
    mutationFn: (id: string) => customerRetentionApi.completePlan(id, outcome),
    onSuccess: async () => { setOutcome(''); await queryClient.invalidateQueries({ queryKey: ['customer-retention'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <EmptyState title="Customer retention is limited to managers" description="Your role cannot view tenant-wide relationship assessments." />

  const rows = accounts.data?.data ?? []
  const selected = detail.data

  return (
    <div className="space-y-6" data-testid="customer-retention-page">
      <PageHeader
        title="Customer retention"
        description="Heuristic relationship health for companies with an accepted proposal. This is not a churn prediction."
        actions={<Button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending}>Assess stored records</Button>}
      />
      {refresh.isError ? <p className="text-sm text-destructive">The assessment could not be saved. No classification was invented.</p> : null}

      {analytics.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {analytics.isError ? <p className="text-sm text-destructive">Retention counts could not be loaded.</p> : null}
      {analytics.data ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-base">Customers</CardTitle></CardHeader><CardContent>{analytics.data.customers}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">At risk</CardTitle></CardHeader><CardContent>{analytics.data.atRisk}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Attention needed</CardTitle></CardHeader><CardContent>{analytics.data.attentionNeeded}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Insufficient data</CardTitle></CardHeader><CardContent>{analytics.data.insufficientData}</CardContent></Card>
        </div>
      ) : null}
      {analytics.data ? <p className="text-sm text-muted-foreground">{analytics.data.note} Churn rate is not shown because it is {analytics.data.churnRate === null ? 'not calculated' : 'unavailable'}.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer risk list</CardTitle>
          <CardDescription>Classifications come from stored messages, tasks, and proposals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Relationship health filter">
            {FILTERS.map((filter) => (
              <Button key={filter.id || 'all'} type="button" size="sm" variant={classification === filter.id ? 'default' : 'outline'} onClick={() => setClassification(filter.id)}>
                {filter.label}
              </Button>
            ))}
          </div>
          {accounts.isLoading ? <Skeleton className="h-20 w-full" /> : null}
          {accounts.isError ? <p className="text-sm text-destructive">The customer list could not be loaded.</p> : null}
          {!accounts.isLoading && rows.length === 0 ? <p className="text-sm text-muted-foreground">No assessed customers match this filter. Run an assessment after a proposal is accepted.</p> : null}
          {rows.map((row) => (
            <button key={row.companyId} type="button" className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left" onClick={() => setCompanyId(row.companyId)}>
              <span>
                <span className="block font-medium">{row.companyName ?? 'Company'}</span>
                <span className="block text-sm text-muted-foreground">{row.explanation}</span>
              </span>
              <Badge>{label(row.classification)}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      {selected ? <RelationshipDetail account={selected.account} recommendations={selected.recommendations} plans={selected.plans} /> : null}

      <Card>
        <CardHeader><CardTitle>Retention recommendations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {recommendations.isLoading ? <Skeleton className="h-16 w-full" /> : null}
          {(recommendations.data ?? []).length === 0 && !recommendations.isLoading ? <p className="text-sm text-muted-foreground">No recommendations are stored.</p> : null}
          {(recommendations.data ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{item.title}</p>
              <p>{item.explanation}</p>
              <p className="text-muted-foreground">Evidence: {item.evidence}</p>
              <p>Priority {item.priority}. Status {item.status}. Confidence {item.confidence}.</p>
              <p>Next action: {item.action}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" disabled={Boolean(item.taskId) || followUp.isPending} onClick={() => followUp.mutate(item.id)}>
                {item.taskId ? 'Task already created' : 'Create follow-up task'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Action plans</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(plans.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No action plans are stored.</p> : null}
          {(plans.data ?? []).map((plan) => (
            <div key={plan.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{plan.title}</p>
              <p>Status {plan.status}. Priority {plan.priority}. Due {plan.dueAt ?? 'not set'}.</p>
              <p>Expected: {plan.expectedOutcome}</p>
              <p>Actual: {plan.actualOutcome ?? 'Not recorded. Completion does not prove the customer stayed.'}</p>
              {plan.status !== 'completed' ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input aria-label="Actual outcome" className="rounded-md border bg-background px-2 py-1" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
                  <Button type="button" size="sm" onClick={() => complete.mutate(plan.id)} disabled={outcome.trim().length < 3 || complete.isPending}>Record outcome</Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function RelationshipDetail({ account, recommendations, plans }: { account: RetentionAccount; recommendations: Array<{ title: string; evidence: string }>; plans: Array<{ title: string; status: string }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relationship details</CardTitle>
        <CardDescription>Last interaction {account.lastInteractionAt ?? 'not stored'}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Health: {label(account.classification)}. Confidence {account.confidence}. Data {account.dataSufficiency}.</p>
        <p>{account.explanation}</p>
        {account.signals.length === 0 ? <p>No supporting signal is stored.</p> : account.signals.map((signal) => (
          <p key={`${signal.code}:${signal.sourceId}`}>Fact: {signal.summary}</p>
        ))}
        {recommendations.map((item) => <p key={item.title}>Recommendation: {item.title}. {item.evidence}</p>)}
        {plans.map((plan) => <p key={plan.title}>Plan: {plan.title} ({plan.status})</p>)}
      </CardContent>
    </Card>
  )
}
