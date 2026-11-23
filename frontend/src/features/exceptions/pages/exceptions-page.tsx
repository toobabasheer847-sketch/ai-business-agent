import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermissions } from '@/features/authorization/use-permissions'
import { exceptionsApi } from '@/features/exceptions/api/exceptions.api'
import { availableActions, exceptionLabel, relatedHref, severityClass } from '@/features/exceptions/lib/exception-display'
import { getErrorMessage } from '@/lib/api'
import { usersApi } from '@/features/users/api/users.api'
import { cn } from '@/lib/utils'
import type { ExceptionFilters, ExceptionRecord, ExceptionSummary } from '@/features/exceptions/types/exception.types'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical', severity: 'critical' },
  { id: 'high', label: 'High', severity: 'high' },
  { id: 'medium', label: 'Medium', severity: 'medium' },
  { id: 'low', label: 'Low', severity: 'low' },
  { id: 'open', label: 'Open', status: 'open' },
  { id: 'acknowledged', label: 'Acknowledged', status: 'acknowledged' },
  { id: 'in_progress', label: 'In progress', status: 'in_progress' },
  { id: 'resolved', label: 'Resolved', status: 'resolved' },
  { id: 'dismissed', label: 'Dismissed', status: 'dismissed' },
] as const

export function ExceptionsPage() {
  const { canAccess, isBootstrapping } = usePermissions()
  const allowed = canAccess(['audit.view'])
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ExceptionFilters>({ page: 1, limit: 20, sort: 'priority' })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignee, setAssignee] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'resolve' | 'dismiss' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const summary = useQuery({ queryKey: ['exceptions', 'summary'], queryFn: exceptionsApi.summary, enabled: allowed })
  const list = useQuery({ queryKey: ['exceptions', 'list', filters], queryFn: () => exceptionsApi.list(filters), enabled: allowed })
  const detail = useQuery({ queryKey: ['exceptions', 'detail', selectedId], queryFn: () => exceptionsApi.find(selectedId as string), enabled: allowed && Boolean(selectedId) })
  const users = useQuery({ queryKey: ['users', 'exception-assign'], queryFn: () => usersApi.list({}), enabled: allowed && Boolean(selectedId) })
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['exceptions'] }) }
  const onActionError = (error: unknown) => setActionError(getErrorMessage(error))
  const detect = useMutation({ mutationFn: exceptionsApi.detect, onSuccess: refresh, onError: onActionError })
  const acknowledge = useMutation({ mutationFn: exceptionsApi.acknowledge, onSuccess: refresh, onError: onActionError })
  const assign = useMutation({ mutationFn: ({ id, userId }: { id: string; userId: string }) => exceptionsApi.assign(id, userId), onSuccess: refresh, onError: onActionError })
  const progress = useMutation({ mutationFn: (id: string) => exceptionsApi.status(id, 'in_progress'), onSuccess: refresh, onError: onActionError })
  const resolve = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => exceptionsApi.resolve(id, text), onSuccess: async () => { setConfirm(null); await refresh() }, onError: onActionError })
  const dismiss = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => exceptionsApi.dismiss(id, text), onSuccess: async () => { setConfirm(null); await refresh() }, onError: onActionError })
  const pageCount = Math.max(1, Math.ceil((list.data?.total ?? 0) / (filters.limit ?? 20)))
  const record = detail.data

  if (isBootstrapping) return <Skeleton className="h-48 w-full" />
  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Exception Center" description="Operational problems detected from this tenant's records." />
        <EmptyState title="Exception Center is limited to managers" description="Owner and admin roles can review operational exceptions." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exception Center"
        description="Operational problems detected from this tenant's records. Suggestions are rules, not verified forecasts."
        actions={<Button onClick={() => detect.mutate()} disabled={!allowed || detect.isPending}>Run detection</Button>}
      />
      {summary.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {summary.isError ? <EmptyState title="Exception summary is unavailable" action={<Button onClick={() => summary.refetch()}>Retry</Button>} /> : null}
      {summary.data ? <Overview summary={summary.data} /> : null}
      {actionError ? <EmptyState title="That action did not complete" description={actionError} action={<Button onClick={() => setActionError(null)}>Dismiss</Button>} /> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Exception filters">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            size="sm"
            variant={activeFilter(filters, filter.id) ? 'default' : 'outline'}
            onClick={() => setFilters({ page: 1, limit: 20, sort: 'priority', severity: 'severity' in filter ? filter.severity : undefined, status: 'status' in filter ? filter.status : undefined })}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, page: 1, search }) }}>
        <Input aria-label="Search exceptions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or explanation" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {list.isLoading ? <Skeleton className="h-48 w-full" data-testid="exceptions-loading" /> : null}
      {list.isError ? <EmptyState title="Exceptions could not be loaded" action={<Button onClick={() => list.refetch()}>Retry</Button>} /> : null}
      {list.data && list.data.total === 0 ? <EmptyState title="No exceptions" description="Detection only creates a row when a real record matches a rule." /> : null}
      {list.data && list.data.data.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Detected exceptions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => { setSelectedId(row.id); setAssignee(row.assignedTo ?? ''); setNote(''); setConfirm(null); setActionError(null) }}>
                    <TableCell>
                      <div className="font-medium">{row.title}</div>
                      <p className="mt-1 max-w-xl text-muted-foreground">{row.description}</p>
                      <p className="mt-1 text-muted-foreground">Next: {row.recommendedAction}</p>
                      {row.assigneeName ? <p className="mt-1">Assigned to {row.assigneeName}</p> : null}
                    </TableCell>
                    <TableCell>{exceptionLabel(row.category)}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('border-transparent', severityClass(row.severity))}>{exceptionLabel(row.severity)}</Badge></TableCell>
                    <TableCell>{row.priorityScore}</TableCell>
                    <TableCell>{new Date(row.detectedAt).toLocaleString()}</TableCell>
                    <TableCell>{exceptionLabel(row.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>{list.data.total} total</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>Previous</Button>
                <Button type="button" size="sm" variant="outline" disabled={(filters.page ?? 1) >= pageCount} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{record?.title ?? 'Exception'}</DialogTitle></DialogHeader>
          {detail.isLoading ? <Skeleton className="h-32 w-full" /> : null}
          {detail.isError ? <EmptyState title="Exception details could not be loaded" action={<Button onClick={() => detail.refetch()}>Retry</Button>} /> : null}
          {record ? <Detail record={record} allowed={allowed} assignee={assignee} setAssignee={setAssignee} users={(users.data ?? []).filter((user) => user.isActive)} note={note} setNote={setNote} confirm={confirm} setConfirm={setConfirm} busy={acknowledge.isPending || assign.isPending || progress.isPending || resolve.isPending || dismiss.isPending} onAcknowledge={() => acknowledge.mutate(record.id)} onAssign={() => assignee && assign.mutate({ id: record.id, userId: assignee })} onProgress={() => progress.mutate(record.id)} onResolve={() => resolve.mutate({ id: record.id, text: note })} onDismiss={() => dismiss.mutate({ id: record.id, text: note })} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function activeFilter(filters: ExceptionFilters, id: string) {
  if (id === 'all') return !filters.severity && !filters.status
  return filters.severity === id || filters.status === id
}

function Overview({ summary }: { summary: ExceptionSummary }) {
  const cards = [
    ['Open', summary.open],
    ['Critical', summary.critical],
    ['High priority', summary.high],
    ['Resolved today', summary.resolvedToday],
  ] as const
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{value}</CardContent></Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{summary.insight}</p>
    </div>
  )
}

function Detail({
  record, allowed, assignee, setAssignee, users, note, setNote, confirm, setConfirm, busy, onAcknowledge, onAssign, onProgress, onResolve, onDismiss,
}: {
  record: ExceptionRecord
  allowed: boolean
  assignee: string
  setAssignee: (value: string) => void
  users: Array<{ id: string; name: string }>
  note: string
  setNote: (value: string) => void
  confirm: 'resolve' | 'dismiss' | null
  setConfirm: (value: 'resolve' | 'dismiss' | null) => void
  busy: boolean
  onAcknowledge: () => void
  onAssign: () => void
  onProgress: () => void
  onResolve: () => void
  onDismiss: () => void
}) {
  const href = relatedHref(record.sourceType)
  const actions = availableActions(record.status)
  const manageable = allowed && (actions.resolve || actions.assign)
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium">What happened</p>
        <p>{record.description}</p>
      </div>
      <div>
        <p className="font-medium">Why it matters</p>
        <p>{record.priorityReason}</p>
      </div>
      <div>
        <p className="font-medium">Evidence</p>
        <p>{record.evidence ?? record.description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-muted-foreground">Detected</dt><dd>{new Date(record.detectedAt).toLocaleString()}</dd></div>
        <div><dt className="text-muted-foreground">Occurrences</dt><dd>{record.occurrenceCount}</dd></div>
        <div><dt className="text-muted-foreground">Source</dt><dd>{record.sourceType}</dd></div>
        <div><dt className="text-muted-foreground">Status</dt><dd>{exceptionLabel(record.status)}</dd></div>
        <div><dt className="text-muted-foreground">Assigned</dt><dd>{record.assigneeName ?? 'Unassigned'}</dd></div>
      </dl>
      <div>
        <p className="font-medium">Suggested next action</p>
        <p>{record.suggestion ?? record.recommendedAction}</p>
        <p className="text-xs text-muted-foreground">
          {record.suggestionSource === 'model'
            ? 'This wording is a model suggestion. It is not a verified business fact.'
            : 'This suggestion is generated from the detected facts. It is not a verified business fact.'}
        </p>
      </div>
      {href ? <Button asChild variant="outline" size="sm"><Link to={href}>Open related record</Link></Button> : null}
      {manageable ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {actions.acknowledge ? <Button type="button" size="sm" disabled={busy} onClick={onAcknowledge}>Acknowledge</Button> : null}
            {actions.progress ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onProgress}>Mark in progress</Button> : null}
            {actions.resolve ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setNote(''); setConfirm('resolve') }}>Resolve</Button> : null}
            {actions.dismiss ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setNote(''); setConfirm('dismiss') }}>Dismiss</Button> : null}
          </div>
          {actions.assign ? (
            <div className="flex gap-2">
              <select aria-label="Assign to" className="h-9 flex-1 rounded-lg border bg-background px-3" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="">Choose a teammate</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <Button type="button" size="sm" variant="outline" disabled={busy || !assignee} onClick={onAssign}>Assign</Button>
            </div>
          ) : null}
          {confirm ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p>{confirm === 'resolve' ? 'Resolve this exception?' : 'Dismiss this exception?'}</p>
              <Input aria-label={confirm === 'resolve' ? 'Resolution note' : 'Dismissal reason'} value={note} onChange={(event) => setNote(event.target.value)} placeholder={confirm === 'resolve' ? 'Optional note' : 'Reason'} />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy || (confirm === 'dismiss' && note.trim().length < 3)} onClick={confirm === 'resolve' ? onResolve : onDismiss}>Confirm</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
