import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/authorization/use-permissions'
import { workflowAnalyticsApi } from '@/features/workflow-analytics/api/workflow-analytics.api'
import { workflowsApi } from '@/features/workflows/api/workflows.api'
import { getErrorMessage } from '@/lib/api/errors'
import type { GenerationResult, WorkflowDefinition, WorkflowRecord } from '@/features/workflows/types/workflow.types'

const EMPTY_DEFINITION: WorkflowDefinition = {
  schemaVersion: 1,
  trigger: { type: 'manual' },
  conditions: [],
  actions: [{ key: 'task', type: 'create_task', input: { title: 'Follow up' } }],
  settings: { maxRetries: 2, timeoutMs: 30000 },
}

export function WorkflowsPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['workflow.manage'])
  const queryClient = useQueryClient()
  const [instruction, setInstruction] = useState('')
  const [name, setName] = useState('Follow-up workflow')
  const [proposal, setProposal] = useState<GenerationResult | null>(null)
  const [definition, setDefinition] = useState<WorkflowDefinition>(EMPTY_DEFINITION)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const summary = useQuery({ queryKey: ['workflows', 'summary'], queryFn: workflowsApi.summary, enabled: allowed })
  const list = useQuery({ queryKey: ['workflows', 'list'], queryFn: () => workflowsApi.list({}), enabled: allowed })
  const detail = useQuery({ queryKey: ['workflows', 'detail', selectedId], queryFn: () => workflowsApi.find(selectedId as string), enabled: allowed && Boolean(selectedId) })
  const history = useQuery({ queryKey: ['workflows', 'executions', selectedId], queryFn: () => workflowsApi.executions(selectedId as string), enabled: allowed && Boolean(selectedId) })
  const analytics = useQuery({ queryKey: ['workflow-analytics', 'workflow', selectedId], queryFn: () => workflowAnalyticsApi.workflow(selectedId as string, { range: '30d' }), enabled: allowed && Boolean(selectedId) })
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['workflows'] }) }
  const onError = (error: unknown) => setActionError(getErrorMessage(error))
  const generate = useMutation({ mutationFn: () => workflowsApi.generate(instruction), onSuccess: (result) => { setProposal(result); if (result.proposal) setDefinition(result.proposal) }, onError })
  const save = useMutation({ mutationFn: () => workflowsApi.create({ name, description: proposal?.summary, definition }), onSuccess: refresh, onError })
  const activate = useMutation({ mutationFn: workflowsApi.activate, onSuccess: refresh, onError })
  const pause = useMutation({ mutationFn: workflowsApi.pause, onSuccess: refresh, onError })
  const resume = useMutation({ mutationFn: workflowsApi.resume, onSuccess: refresh, onError })
  const execute = useMutation({ mutationFn: workflowsApi.execute, onSuccess: refresh, onError })

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Workflows" description="Controlled automation for this tenant." />
        <EmptyState title="Workflows are limited to managers" description="Owner and admin roles can create and run workflows." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Workflows" description="Suggested workflows stay drafts until you activate them. Customer messages wait for the Approval Center." />
      {summary.isLoading ? <Skeleton className="h-24 w-full" data-testid="workflows-loading" /> : null}
      {summary.isError ? <EmptyState title="Workflow summary is unavailable" action={<Button onClick={() => summary.refetch()}>Retry</Button>} /> : null}
      {summary.data ? <Overview summary={summary.data} /> : null}
      {actionError ? <EmptyState title="That action did not complete" description={actionError} action={<Button onClick={() => setActionError(null)}>Dismiss</Button>} /> : null}
      <Card>
        <CardHeader><CardTitle>Create a workflow</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); generate.mutate() }}>
            <Input aria-label="Workflow instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="When a new lead is created, create a follow-up task." />
            <Button type="submit" variant="outline" disabled={generate.isPending || instruction.trim().length < 8}>Generate</Button>
          </form>
          {proposal ? <GenerationReview result={proposal} /> : null}
          <label className="block space-y-1 text-sm">
            <span>Name</span>
            <Input aria-label="Workflow name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Task title</span>
            <Input aria-label="Task title" value={definition.actions[0]?.input.title ?? ''} onChange={(event) => setDefinition({ ...definition, actions: [{ ...definition.actions[0], key: definition.actions[0]?.key ?? 'task', type: definition.actions[0]?.type ?? 'create_task', input: { ...definition.actions[0]?.input, title: event.target.value } }] })} />
          </label>
          <p className="text-sm text-muted-foreground">Trigger: {definition.trigger.type}. Actions: {definition.actions.map((action) => action.type).join(', ') || 'none'}.</p>
          <Button type="button" disabled={save.isPending || name.trim().length < 3} onClick={() => save.mutate()}>Save draft</Button>
        </CardContent>
      </Card>
      {list.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {list.isError ? <EmptyState title="Workflows could not be loaded" action={<Button onClick={() => list.refetch()}>Retry</Button>} /> : null}
      {list.data && list.data.total === 0 ? <EmptyState title="No workflows" description="Save a draft after reviewing a supported trigger and action." /> : null}
      {list.data && list.data.data.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Saved workflows</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {list.data.data.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="text-left" onClick={() => setSelectedId(row.id)}>
                  <span className="font-medium">{row.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{row.triggerType} · version {row.version}</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{row.status}</Badge>
                  {row.status === 'draft' || row.status === 'paused' ? <Button size="sm" disabled={activate.isPending || resume.isPending} onClick={() => (row.status === 'paused' ? resume.mutate(row.id) : activate.mutate(row.id))}>{row.status === 'paused' ? 'Resume' : 'Activate'}</Button> : null}
                  {row.status === 'active' ? <Button size="sm" variant="outline" disabled={pause.isPending} onClick={() => pause.mutate(row.id)}>Pause</Button> : null}
                  {row.status === 'active' ? <Button size="sm" variant="outline" disabled={execute.isPending} onClick={() => execute.mutate(row.id)}>Run now</Button> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{detail.data?.name ?? 'Workflow'}</DialogTitle></DialogHeader>
          {detail.isLoading || history.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {detail.data ? <WorkflowDetail record={detail.data} executions={history.data?.data ?? []} analytics={analytics.data ?? null} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Overview({ summary }: { summary: { total: number; active: number; paused: number; completed: number; failed: number; waiting: number; recentFailures: Array<{ id: string; sanitizedError: string | null }> } }) {
  const cards = [
    ['Workflows', summary.total],
    ['Active', summary.active],
    ['Paused', summary.paused],
    ['Successful runs', summary.completed],
    ['Failed runs', summary.failed],
    ['Waiting for approval', summary.waiting],
  ] as const
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{value}</CardContent></Card>
        ))}
      </div>
      {summary.recentFailures.map((item) => <p key={item.id} className="text-sm">Failed: {item.sanitizedError ?? item.id}</p>)}
    </div>
  )
}

function GenerationReview({ result }: { result: GenerationResult }) {
  return (
    <div className="space-y-1 rounded-lg border p-3 text-sm">
      <p>{result.summary}</p>
      <p className="text-muted-foreground">Source: {result.source === 'model' ? 'model suggestion' : 'rule suggestion'}. This is not an active workflow.</p>
      {result.missing.length ? <p>Missing: {result.missing.join(', ')}</p> : null}
      {result.unsupported.length ? <p>Unsupported: {result.unsupported.join(', ')}</p> : null}
      {result.errors.length ? <p>Validation: {result.errors.join(' ')}</p> : null}
    </div>
  )
}

function WorkflowDetail({ record, executions, analytics }: { record: WorkflowRecord; executions: Array<{ id: string; status: string; triggerSource: string; startedAt: string; durationMs: number | null; sanitizedError: string | null; steps?: Array<{ id: string; actionType: string; status: string; sanitizedError: string | null }> }>; analytics: { healthLabel: string; healthFactors: string[]; successRate: number | null; failureRate: number | null; executions: number; steps: Array<{ actionType: string; averageDurationMs: number | null }> } | null }) {
  return (
    <div className="space-y-3 text-sm">
      <p>{record.description}</p>
      <p>Status {record.status}. Version {record.version}. Trigger {record.definition.trigger.type}.</p>
      <p>Actions: {record.definition.actions.map((action) => action.type).join(', ')}</p>
      {analytics ? (
        <div className="rounded-lg border p-3">
          <p>Analytics: {analytics.executions} executions. Success {analytics.successRate === null ? 'not enough data' : `${analytics.successRate}%`}. Failure {analytics.failureRate === null ? 'not enough data' : `${analytics.failureRate}%`}.</p>
          <p>Health {analytics.healthLabel}. {analytics.healthFactors[0]}</p>
          {analytics.steps.map((step) => <p key={step.actionType}>{step.actionType} average {step.averageDurationMs === null ? 'not enough data' : `${step.averageDurationMs} ms`}</p>)}
        </div>
      ) : null}
      {executions.length === 0 ? <p className="text-muted-foreground">No executions yet.</p> : null}
      {executions.map((execution) => (
        <div key={execution.id} className="rounded-lg border p-3">
          <p>{execution.status} · {execution.triggerSource}</p>
          <p className="text-muted-foreground">{new Date(execution.startedAt).toLocaleString()}{execution.durationMs != null ? ` · ${execution.durationMs} ms` : ''}</p>
          {execution.sanitizedError ? <p>{execution.sanitizedError}</p> : null}
          {(execution.steps ?? []).map((step) => <p key={step.id}>{step.actionType}: {step.status}{step.sanitizedError ? ` · ${step.sanitizedError}` : ''}</p>)}
        </div>
      ))}
    </div>
  )
}
