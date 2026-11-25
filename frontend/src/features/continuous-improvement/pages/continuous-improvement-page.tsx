import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/authorization/use-permissions'
import {
  continuousImprovementApi,
  type Bottleneck,
  type ImprovementPlan,
  type Recommendation,
} from '@/features/continuous-improvement/api/continuous-improvement.api'

function evidenceText(evidence: Bottleneck['evidence']) {
  if (Array.isArray(evidence)) return evidence.join(' ')
  return evidence.lines?.join(' ') ?? ''
}

export function ContinuousImprovementPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['analytics.view'])
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['continuous-improvement', 'overview'], queryFn: continuousImprovementApi.overview, enabled: allowed })
  const savedBottlenecks = useQuery({ queryKey: ['continuous-improvement', 'bottlenecks'], queryFn: continuousImprovementApi.bottlenecks, enabled: allowed })
  const recommendations = useQuery({ queryKey: ['continuous-improvement', 'recommendations'], queryFn: continuousImprovementApi.recommendations, enabled: allowed })
  const plans = useQuery({ queryKey: ['continuous-improvement', 'plans'], queryFn: continuousImprovementApi.plans, enabled: allowed })
  const outcomes = useQuery({ queryKey: ['continuous-improvement', 'outcomes'], queryFn: continuousImprovementApi.outcomes, enabled: allowed })
  const reviews = useQuery({ queryKey: ['continuous-improvement', 'reviews'], queryFn: continuousImprovementApi.reviews, enabled: allowed })
  const history = useQuery({ queryKey: ['continuous-improvement', 'history'], queryFn: continuousImprovementApi.history, enabled: allowed })
  const refresh = useMutation({
    mutationFn: continuousImprovementApi.refresh,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <EmptyState title="Continuous improvement is limited to managers" description="Your role cannot view tenant-wide performance." />

  return (
    <div className="space-y-8">
      <PageHeader
        title="Continuous improvement"
        description="Observe, analyze, and review stored business results. Nothing here changes a plan or sends a message until you do."
        actions={<Button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending}>Refresh monitoring</Button>}
      />
      {overview.isLoading ? <Skeleton className="h-28 w-full" /> : null}
      {overview.isError ? (
        <EmptyState title="Continuous improvement could not be loaded" action={<Button type="button" onClick={() => overview.refetch()}>Retry</Button>} />
      ) : null}
      {overview.data ? (
        <>
          <p className="text-sm text-muted-foreground">{overview.data.classification.causal}</p>
          <p className="text-sm text-muted-foreground">{overview.data.schedule.note}</p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {overview.data.cycle.stages.map((stage) => (
              <li key={stage} className={`rounded-lg border px-3 py-2 text-sm ${overview.data?.cycle.current === stage ? 'border-primary bg-primary/10' : ''}`}>
                {stage}
                {overview.data?.cycle.current === stage ? <span className="mt-1 block text-xs text-muted-foreground">Current stage</span> : null}
              </li>
            ))}
          </ol>
          <section className="grid gap-3 md:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-base">Active improvement plans</CardTitle></CardHeader><CardContent>{overview.data.activePlans.length}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Goals at risk</CardTitle></CardHeader><CardContent>{overview.data.goalsAtRisk.length === 0 ? 'None from stored goal dates.' : overview.data.goalsAtRisk.map((goal) => <p key={goal.id}>{goal.name}: {goal.note}</p>)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Live findings</CardTitle></CardHeader><CardContent className="text-sm">{overview.data.deviations.length} deviations, {overview.data.bottlenecks.length} bottlenecks, {overview.data.recommendations.length} recommendations.</CardContent></Card>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Performance deviations</h2>
            {overview.data.deviations.length === 0 ? <EmptyState title="No material deviation" description="Small changes and missing comparisons are not turned into alerts." /> : null}
            {overview.data.deviations.map((item) => (
              <Card key={`${item.metricKey}-${item.deviationType}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{item.metricName}</CardTitle>
                  <Badge>{item.deviationType}</Badge>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>Baseline {item.baselineValue ?? 'Missing'}. Current {item.currentValue ?? 'Missing'}. Target {item.targetValue ?? 'Missing'}.</p>
                  <p>Change {item.deviationValue ?? 'Not calculated'}. Percentage {item.deviationPercentage ?? 'Withheld'}. Trend {item.trendDirection}. Confidence {item.confidenceLevel}.</p>
                  <p>{item.evidence.join(' ')}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Improvement opportunities</h2>
            {overview.data.opportunities.length === 0 ? <EmptyState title="No opportunity is supported by this period" /> : null}
            {overview.data.opportunities.map((item) => (
              <Card key={item.key}><CardContent className="space-y-1 pt-6 text-sm"><p className="font-medium">{item.title}</p><p>{item.suggestedImprovement}</p><p>{item.potentialBenefit}</p></CardContent></Card>
            ))}
          </section>
        </>
      ) : null}
      <BottleneckSection rows={savedBottlenecks.data?.data ?? []} loading={savedBottlenecks.isLoading} empty={!savedBottlenecks.isLoading && (savedBottlenecks.data?.data.length ?? 0) === 0} />
      <RecommendationSection rows={recommendations.data?.data ?? []} loading={recommendations.isLoading} />
      <PlanSection rows={plans.data?.data ?? []} loading={plans.isLoading} />
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Outcome evaluation</h2>
          <EvaluateButton />
        </div>
        <p className="text-sm text-muted-foreground">A completed action, an observed metric change, and a causal conclusion are separate. This screen does not claim causation.</p>
        {outcomes.isLoading ? <Skeleton className="h-20 w-full" /> : null}
        {outcomes.data?.data.length === 0 ? <EmptyState title="No outcome evaluation is saved" description="Evaluate after a completed action plan has a measurement window and a stored metric." /> : null}
        {outcomes.data?.data.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium">{item.metricKey}</p>
              <p>Status {item.evaluationStatus}. Baseline {item.baselineValue ?? 'Missing'}. Measured {item.measuredValue ?? 'Missing'}.</p>
              <p>Window {item.evaluationPeriodStart} to {item.evaluationPeriodEnd}.</p>
              <p>{item.evidence.statement}</p>
              <p>Causal conclusion: {item.evidence.causalClaim ? 'recorded' : 'not claimed'}.</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <ReviewSection rows={reviews.data?.data ?? []} loading={reviews.isLoading} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Improvement history</h2>
        {history.isLoading ? <Skeleton className="h-20 w-full" /> : null}
        {history.data?.data.length === 0 ? <EmptyState title="No improvement history yet" /> : null}
        <ol className="space-y-2">
          {history.data?.data.map((event) => (
            <li key={event.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{event.eventType}</p>
              <p>{event.relatedEntityType} at {event.occurredAt}</p>
              <p>Actor {event.actorId ?? 'System'}.</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function BottleneckSection({ rows, loading, empty }: { rows: Bottleneck[]; loading: boolean; empty: boolean }) {
  const queryClient = useQueryClient()
  const review = useMutation({
    mutationFn: continuousImprovementApi.reviewBottleneck,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'bottlenecks'] }) },
  })
  const resolve = useMutation({
    mutationFn: continuousImprovementApi.resolveBottleneck,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'bottlenecks'] }) },
  })
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Bottleneck center</h2>
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {empty ? <EmptyState title="No saved bottleneck" description="Refresh monitoring to save the current pattern. Resolving a bottleneck does not create an exception." /> : null}
      {rows.map((item) => (
        <Card key={item.id ?? item.fingerprint}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{item.title}</CardTitle>
            <Badge>{item.status ?? item.severity}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Category {item.category}. Process {item.affectedProcess}. Severity {item.severity}. Confidence {item.confidenceLevel}.</p>
            <p>{evidenceText(item.evidence)}</p>
            <p>{item.recommendedInvestigation}</p>
            {item.id && item.status === 'open' ? <Button type="button" variant="outline" onClick={() => review.mutate(item.id as string)}>Mark reviewed</Button> : null}
            {item.id && item.status !== 'resolved' ? <Button type="button" onClick={() => resolve.mutate(item.id as string)}>Resolve</Button> : null}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function RecommendationSection({ rows, loading }: { rows: Recommendation[]; loading: boolean }) {
  const queryClient = useQueryClient()
  const [linked, setLinked] = useState<string | null>(null)
  const accept = useMutation({ mutationFn: continuousImprovementApi.accept, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'recommendations'] }) } })
  const reject = useMutation({ mutationFn: continuousImprovementApi.reject, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'recommendations'] }) } })
  const feedback = useMutation({ mutationFn: continuousImprovementApi.feedback })
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Improvement recommendations</h2>
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {rows.length === 0 && !loading ? <EmptyState title="No saved recommendation" description="Refresh monitoring to save recommendations from the current evidence." /> : null}
      {rows.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{item.title}</CardTitle>
            <Badge>{item.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{item.description}</p>
            <p>Evidence: {item.evidence.join(' ')}</p>
            <p>Priority {item.priorityScore ?? item.priority}. Confidence {item.confidenceLevel ?? item.confidence}. Expected outcome: {item.expectedOutcome}</p>
            <p>{item.risks}</p>
            {item.status === 'open' && item.id ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => accept.mutate(item.id as string)}>Accept</Button>
                <Button type="button" variant="outline" onClick={() => reject.mutate(item.id as string)}>Reject</Button>
                <Button type="button" variant="outline" onClick={() => feedback.mutate(item.id as string)}>Mark useful</Button>
                <Button type="button" variant="outline" onClick={() => setLinked(item.id as string)}>Create improvement plan</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
      <PlanForm recommendationId={linked} />
    </section>
  )
}

function PlanSection({ rows, loading }: { rows: ImprovementPlan[]; loading: boolean }) {
  const queryClient = useQueryClient()
  const activate = useMutation({ mutationFn: continuousImprovementApi.activate, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'plans'] }) } })
  const hold = useMutation({ mutationFn: continuousImprovementApi.hold, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'plans'] }) } })
  const complete = useMutation({ mutationFn: continuousImprovementApi.completePlan, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'plans'] }) } })
  const completeMilestone = useMutation({
    mutationFn: (input: { planId: string; milestoneId: string }) => continuousImprovementApi.completeMilestone(input.planId, input.milestoneId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'plans'] }) },
  })
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Improvement plans</h2>
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {rows.length === 0 && !loading ? <EmptyState title="No improvement plan" /> : null}
      {rows.map((plan) => (
        <Card key={plan.id}>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium">{plan.title}</p>
            <p>{plan.objective}</p>
            <p>Status {plan.status}. Owner {plan.ownerId ?? 'Unassigned'}. Review {plan.reviewSchedule ?? 'Not scheduled'}.</p>
            <p>Baseline {plan.baselineValue ?? 'Missing'}. Target {plan.targetValue ?? 'Missing'}.</p>
            {plan.assessment ? <p>{plan.assessment.progressStatus}. Execution {plan.assessment.executionProgress ?? 'Missing'}%. Outcome {plan.assessment.outcomeProgress ?? 'Missing'}%. {plan.assessment.reason}</p> : null}
            {(plan.milestones ?? []).map((milestone) => (
              <div key={milestone.id} className="rounded-md border p-2">
                <p>{milestone.title}: {milestone.status}</p>
                {milestone.status === 'pending' ? <Button type="button" variant="outline" onClick={() => completeMilestone.mutate({ planId: plan.id, milestoneId: milestone.id })}>Mark milestone done</Button> : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {plan.status === 'DRAFT' || plan.status === 'APPROVED' || plan.status === 'ON_HOLD' ? <Button type="button" onClick={() => activate.mutate(plan.id)}>Activate</Button> : null}
              {plan.status === 'ACTIVE' ? <Button type="button" variant="outline" onClick={() => hold.mutate(plan.id)}>Hold</Button> : null}
              {plan.status === 'ACTIVE' ? <Button type="button" variant="outline" onClick={() => complete.mutate(plan.id)}>Complete</Button> : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function PlanForm({ recommendationId }: { recommendationId: string | null }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('Improve task completion')
  const [target, setTarget] = useState('0')
  const create = useMutation({
    mutationFn: () => continuousImprovementApi.createPlan({
      title,
      objective: title,
      description: 'Baseline is captured from stored records when this draft is saved. The plan is not activated.',
      category: 'operations',
      metricKey: 'overdue_task_count',
      targetValue: Number(target),
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      recommendationId: recommendationId ?? undefined,
      reviewSchedule: 'monthly',
      milestones: ['Review the overdue task list'],
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'plans'] }) },
  })
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
      <label className="text-sm">Plan title
        <input className="mt-1 block rounded-md border bg-background px-2 py-1" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="text-sm">Overdue target
        <input className="mt-1 block rounded-md border bg-background px-2 py-1" value={target} onChange={(event) => setTarget(event.target.value)} />
      </label>
      <Button type="submit" disabled={create.isPending}>Save draft plan</Button>
    </form>
  )
}

function EvaluateButton() {
  const queryClient = useQueryClient()
  const evaluate = useMutation({
    mutationFn: continuousImprovementApi.evaluate,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'outcomes'] }) },
  })
  return <Button type="button" variant="outline" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>Evaluate outcomes</Button>
}

function ReviewSection({ rows, loading }: { rows: Array<{ id: string; status: string; summary: string; decision: string | null }>; loading: boolean }) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState('Keep the current plans and review the open bottleneck.')
  const create = useMutation({
    mutationFn: continuousImprovementApi.createReview,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'reviews'] }) },
  })
  const complete = useMutation({
    mutationFn: (id: string) => continuousImprovementApi.completeReview(id, decision),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['continuous-improvement', 'reviews'] }) },
  })
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Improvement reviews</h2>
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>Create monthly review</Button>
      </div>
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {rows.length === 0 && !loading ? <EmptyState title="No improvement review" description="A review stays incomplete until you mark it complete." /> : null}
      {rows.map((review) => (
        <Card key={review.id}>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p>Status {review.status}.</p>
            <p className="whitespace-pre-wrap">{review.summary}</p>
            {review.decision ? <p>Decision: {review.decision}</p> : null}
            {review.status === 'draft' ? (
              <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); complete.mutate(review.id) }}>
                <label className="block text-sm">Decision
                  <input className="mt-1 block w-full rounded-md border bg-background px-2 py-1" value={decision} onChange={(event) => setDecision(event.target.value)} />
                </label>
                <Button type="submit">Complete review</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
