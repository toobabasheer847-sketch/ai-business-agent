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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { approvalsApi } from '@/features/approvals/api/approvals.api'
import { approvalStatusClass, approvalStatusLabel, editableFields, needsHighRiskConfirmation } from '@/features/approvals/lib/approval-display'
import { cn } from '@/lib/utils'
import type { ApprovalFilters, ApprovalRecord, ApprovalSummary } from '@/features/approvals/types/approval.types'

const EMPTY: ApprovalFilters = { page: 1 }

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ApprovalFilters>(EMPTY)
  const [draft, setDraft] = useState(EMPTY)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const summary = useQuery({ queryKey: ['approvals', 'summary'], queryFn: approvalsApi.summary })
  const list = useQuery({ queryKey: ['approvals', 'list', filters], queryFn: () => approvalsApi.list(filters) })
  const detail = useQuery({ queryKey: ['approvals', 'detail', selectedId], queryFn: () => approvalsApi.find(selectedId as string), enabled: Boolean(selectedId) })
  const history = useQuery({ queryKey: ['approvals', 'events', selectedId], queryFn: () => approvalsApi.events(selectedId as string), enabled: Boolean(selectedId) })
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['approvals'] }) }
  const approve = useMutation({
    mutationFn: async (record: ApprovalRecord) => {
      const changed: Record<string, string> = {}
      for (const field of editableFields(record.actionType)) {
        const value = edits[field]
        if (value && value !== String(record.originalPayload[field] ?? '')) changed[field] = value
      }
      return Object.keys(changed).length ? approvalsApi.editApprove(record.id, changed) : approvalsApi.approve(record.id)
    },
    onSuccess: refresh,
  })
  const reject = useMutation({ mutationFn: (id: string) => approvalsApi.reject(id, rejectReason), onSuccess: refresh })
  const cancel = useMutation({ mutationFn: approvalsApi.cancel, onSuccess: refresh })

  return (
    <div className="space-y-6">
      <PageHeader title="Approval Center" description="Sensitive AI actions stay here until an authorized person approves the saved snapshot." />
      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, page: 1 }) }}>
        <select aria-label="Status" className="h-9 rounded-lg border bg-background px-3 text-sm" value={draft.status ?? ''} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
          <option value="">Any status</option>
          {['pending', 'approved', 'executing', 'executed', 'rejected', 'failed', 'expired', 'cancelled'].map((status) => <option key={status} value={status}>{approvalStatusLabel(status)}</option>)}
        </select>
        <select aria-label="Risk" className="h-9 rounded-lg border bg-background px-3 text-sm" value={draft.riskLevel ?? ''} onChange={(event) => setDraft({ ...draft, riskLevel: event.target.value })}>
          <option value="">Any risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <Input aria-label="Action" placeholder="Action" value={draft.actionType ?? ''} onChange={(event) => setDraft({ ...draft, actionType: event.target.value })} />
        <Input aria-label="Agent" placeholder="Agent" value={draft.agent ?? ''} onChange={(event) => setDraft({ ...draft, agent: event.target.value })} />
        <Input aria-label="Requested by" placeholder="Requested by user id" value={draft.requesterUserId ?? ''} onChange={(event) => setDraft({ ...draft, requesterUserId: event.target.value })} />
        <Input aria-label="From date" type="date" value={draft.from ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        <Input aria-label="To date" type="date" value={draft.to ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        <Button type="submit">Apply filters</Button>
      </form>
      {summary.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {summary.isError ? <EmptyState title="Approval summary is unavailable" action={<Button onClick={() => summary.refetch()}>Retry</Button>} /> : null}
      {summary.data ? <SummaryCards summary={summary.data} /> : null}
      {list.isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {list.isError ? <EmptyState title="Approvals could not be loaded" action={<Button onClick={() => list.refetch()}>Retry</Button>} /> : null}
      {list.data && list.data.total === 0 ? <EmptyState title="No approvals" description="Sensitive AI actions appear here. Nothing is invented when the list is empty." /> : null}
      {list.data && list.data.data.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Approval inbox</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => { setSelectedId(row.id); setRejectReason(''); setEdits({}); setConfirming(false) }}>
                    <TableCell>{row.title}</TableCell>
                    <TableCell className="font-mono text-xs">{row.requesterUserId?.slice(0, 8) ?? 'Unknown'}</TableCell>
                    <TableCell>{row.agentName ?? '—'}</TableCell>
                    <TableCell>{row.targetEntityType} {row.targetEntityId.slice(0, 8)}</TableCell>
                    <TableCell>{row.riskLevel}</TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('border-transparent font-medium', approvalStatusClass(row.status))}>{approvalStatusLabel(row.status)}</Badge></TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); setRejectReason(''); setEdits({}); setConfirming(false) }}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>{list.data.total} approval{list.data.total === 1 ? '' : 's'}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>Previous</Button>
                <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) * (list.data.limit || 20) >= list.data.total} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approval details</DialogTitle></DialogHeader>
          {detail.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {detail.data ? (
            <div className="space-y-4 text-sm">
              <p>{detail.data.description}</p>
              <p className="text-muted-foreground">{detail.data.reason}</p>
              <p>Status: <Badge variant="outline" className={cn('border-transparent font-medium', approvalStatusClass(detail.data.status))}>{approvalStatusLabel(detail.data.status)}</Badge> Risk: {detail.data.riskLevel}.</p>
              <p>Target: {detail.data.targetEntityType} {detail.data.targetEntityId}</p>
              <p>Agent: {detail.data.agentName ?? 'Not recorded'}. Run: {detail.data.agentRunId ?? 'None'}.</p>
              <Payload title="Original values" payload={detail.data.originalPayload} />
              {detail.data.approvedPayload ? <Payload title="Approved values" payload={detail.data.approvedPayload} /> : null}
              {detail.data.status === 'pending' ? (
                <div className="space-y-3">
                  {editableFields(detail.data.actionType).map((field) => (
                    <Input key={field} aria-label={field} placeholder={field} defaultValue={String(detail.data.originalPayload[field] ?? '')} onChange={(event) => setEdits({ ...edits, [field]: event.target.value })} />
                  ))}
                  {confirming ? <p>Confirm this high-risk action. The saved snapshot is what will run.</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={approve.isPending} onClick={() => {
                      if (needsHighRiskConfirmation(detail.data.riskLevel) && !confirming) { setConfirming(true); return }
                      approve.mutate(detail.data)
                    }}>Approve</Button>
                    <Input aria-label="Rejection reason" placeholder="Rejection reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
                    <Button type="button" variant="outline" disabled={rejectReason.trim().length < 3 || reject.isPending} onClick={() => reject.mutate(detail.data.id)}>Reject</Button>
                    <Button type="button" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(detail.data.id)}>Cancel</Button>
                  </div>
                  {approve.isError || reject.isError || cancel.isError ? <p className="text-destructive">The decision was not saved. The action was not executed twice.</p> : null}
                </div>
              ) : null}
              {detail.data.errorSummary ? <p>Error: {detail.data.errorSummary}</p> : null}
              {detail.data.rejectionReason ? <p>Rejection: {detail.data.rejectionReason}</p> : null}
              <div>
                <p className="mb-2 font-medium">History</p>
                {history.data?.map((event) => <p key={event.id}>{approvalStatusLabel(event.eventType)} {event.note ? `— ${event.note}` : ''}</p>)}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCards({ summary }: { summary: ApprovalSummary }) {
  const cards = [
    ['Pending', summary.pending],
    ['Approved', summary.executed],
    ['Rejected', summary.rejected],
    ['Failed', summary.failed],
    ['Expired', summary.expired],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <Card key={String(label)}>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
        </Card>
      ))}
    </div>
  )
}

function Payload({ title, payload }: { title: string; payload: Record<string, unknown> }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      {Object.entries(payload).map(([key, value]) => <p key={key}>{key}: {String(value)}</p>)}
    </div>
  )
}
