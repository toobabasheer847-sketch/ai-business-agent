import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/authorization/use-permissions'
import { strategicDecisionApi } from '@/features/strategic-decisions/api/strategic-decisions.api'

export function StrategicDecisionsPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['analytics.view'])
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['strategic-decisions', 'overview'], queryFn: strategicDecisionApi.overview, enabled: allowed })
  const recommendations = useQuery({ queryKey: ['strategic-decisions', 'recommendations'], queryFn: strategicDecisionApi.recommendations, enabled: allowed })
  const plans = useQuery({ queryKey: ['strategic-decisions', 'plans'], queryFn: strategicDecisionApi.plans, enabled: allowed })
  const actions = useQuery({ queryKey: ['strategic-decisions', 'actions'], queryFn: strategicDecisionApi.actionPlans, enabled: allowed })
  const goals = useQuery({ queryKey: ['strategic-decisions', 'goals'], queryFn: strategicDecisionApi.goals, enabled: allowed })
  const refresh = useMutation({
    mutationFn: strategicDecisionApi.refresh,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions'] }) },
  })
  const accept = useMutation({
    mutationFn: strategicDecisionApi.accept,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'recommendations'] }) },
  })
  const reject = useMutation({
    mutationFn: strategicDecisionApi.reject,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'recommendations'] }) },
  })
  const feedback = useMutation({
    mutationFn: (id: string) => strategicDecisionApi.feedback(id, 'useful'),
  })
  const createAction = useMutation({
    mutationFn: strategicDecisionApi.createActionPlan,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'actions'] }) },
  })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) return <EmptyState title="Strategic decisions are limited to managers" description="Your role cannot view tenant-wide priorities." />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategic decisions"
        description="Priorities and suggestions come from stored counts. They do not change records until you execute an action plan."
        actions={<Button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending}>Refresh priorities</Button>}
      />
      {overview.isLoading ? <Skeleton className="h-28 w-full" /> : null}
      {overview.isError ? <EmptyState title="Strategic decisions could not be loaded" action={<Button type="button" onClick={() => overview.refetch()}>Retry</Button>} /> : null}
      {overview.data ? (
        <>
          <p className="text-sm text-muted-foreground">{overview.data.classification.recommendations}</p>
          <p className="text-sm text-muted-foreground">{overview.data.schedule.note}</p>
          <section className="grid gap-3 md:grid-cols-2">
            {overview.data.priorities.map((priority) => (
              <Card key={priority.key}>
                <CardHeader><CardTitle className="text-base">{priority.title}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>Priority score {priority.score}. Confidence {priority.confidence}.</p>
                  <p>{priority.evidence}</p>
                  <p>Suggested action: {priority.action}</p>
                </CardContent>
              </Card>
            ))}
            {overview.data.priorities.length === 0 ? <EmptyState title="No priority rule matched" /> : null}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Opportunities</h2>
            {overview.data.opportunities.length === 0 ? <EmptyState title="No opportunity is supported by this period" /> : null}
            {overview.data.opportunities.map((item) => (
              <Card key={item.key}>
                <CardContent className="space-y-1 pt-6 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p>{item.benefit}</p>
                  <p>{item.limitation}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <p className="text-sm">{overview.data.outcomes.summary}</p>
        </>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recommendations</h2>
        {recommendations.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {recommendations.data?.data.length === 0 ? <EmptyState title="No saved recommendations" description="Refresh priorities to save the current evidence." /> : null}
        {recommendations.data?.data.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <Badge>{item.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{item.reasoning}</p>
              <p>Evidence: {item.evidence.join(' ')}</p>
              <p>Expected outcome: {item.expectedOutcome}</p>
              <p>Score {item.priorityScore}. Confidence {item.confidenceLevel}. Category {item.category}.</p>
              {item.status === 'open' ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => accept.mutate(item.id)}>Accept</Button>
                  <Button type="button" variant="outline" onClick={() => reject.mutate(item.id)}>Reject</Button>
                  <Button type="button" variant="outline" onClick={() => feedback.mutate(item.id)}>Mark useful</Button>
                </div>
              ) : null}
              {item.status === 'accepted' ? (
                <Button type="button" onClick={() => createAction.mutate(item.id)}>Create action plan</Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <PlanForm />
        {plans.data?.data.length === 0 ? <EmptyState title="No strategic plans" /> : null}
        {plans.data?.data.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium">{plan.title}</p>
              <p>{plan.objective}</p>
              <p>Status {plan.status}. Metric {plan.metricKey}.</p>
              <p>Baseline {plan.baselineValue ?? 'Missing'}. Target {plan.targetValue ?? 'Missing'}.</p>
              <p>{plan.progressNote}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Action plans</h2>
        {actions.data?.data.length === 0 ? <EmptyState title="No action plans" /> : null}
        {actions.data?.data.map((plan) => <ActionCard key={plan.id} plan={plan} />)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Goals</h2>
        <GoalForm />
        {goals.data?.data.length === 0 ? <EmptyState title="No business goals" /> : null}
        {goals.data?.data.map((goal) => (
          <Card key={goal.id}>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium">{goal.name}</p>
              <p>Baseline {goal.baselineValue ?? 'Missing'}. Current {goal.currentValue ?? 'Missing'}. Target {goal.targetValue ?? 'Missing'}.</p>
              <p>{goal.progressNote}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

function ActionCard({ plan }: { plan: { id: string; title: string; status: string; steps?: Array<{ id: string; title: string; actionType: string; status: string; note: string | null }> } }) {
  const queryClient = useQueryClient()
  const execute = useMutation({
    mutationFn: () => strategicDecisionApi.execute(plan.id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'actions'] }) },
  })
  const complete = useMutation({
    mutationFn: (stepId: string) => strategicDecisionApi.completeStep(plan.id, stepId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'actions'] }) },
  })
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{plan.title}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Status {plan.status}.</p>
        {(plan.steps ?? []).map((step) => (
          <div key={step.id} className="rounded-md border p-2">
            <p>{step.title}</p>
            <p>{step.actionType}: {step.status}</p>
            {step.note ? <p>{step.note}</p> : null}
            {step.actionType === 'review' && step.status === 'pending' ? (
              <Button type="button" variant="outline" onClick={() => complete.mutate(step.id)}>Mark review done</Button>
            ) : null}
          </div>
        ))}
        {plan.status === 'ready' || plan.status === 'failed' ? <Button type="button" onClick={() => execute.mutate()}>Execute internal steps</Button> : null}
      </CardContent>
    </Card>
  )
}

function PlanForm() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('Reduce overdue tasks')
  const [target, setTarget] = useState('0')
  const create = useMutation({
    mutationFn: () => strategicDecisionApi.createPlan({
      title,
      objective: title,
      description: 'Baseline is captured from stored records when this plan is saved.',
      category: 'operations',
      metricKey: 'overdue_task_count',
      targetValue: Number(target),
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'plans'] }) },
  })
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
      <label className="text-sm">Plan title<input className="mt-1 block rounded-md border bg-background px-2 py-1" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="text-sm">Overdue target<input className="mt-1 block rounded-md border bg-background px-2 py-1" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <Button type="submit" disabled={create.isPending}>Save draft plan</Button>
    </form>
  )
}

function GoalForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('Fewer overdue tasks')
  const [target, setTarget] = useState('0')
  const create = useMutation({
    mutationFn: () => strategicDecisionApi.createGoal({
      name,
      description: 'Current and baseline values are read from tasks when the goal is saved.',
      metricKey: 'overdue_task_count',
      targetValue: Number(target),
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['strategic-decisions', 'goals'] }) },
  })
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
      <label className="text-sm">Goal name<input className="mt-1 block rounded-md border bg-background px-2 py-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-sm">Target<input className="mt-1 block rounded-md border bg-background px-2 py-1" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <Button type="submit" disabled={create.isPending}>Save goal</Button>
    </form>
  )
}
