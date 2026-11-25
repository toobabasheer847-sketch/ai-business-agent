import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { customerFacingApi } from '@/features/customer-facing/api/customer-facing.api'
import { Permission } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { useUsers } from '@/features/users/hooks/use-users'

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export function CustomerConversationsPage() {
  const { canAccess } = usePermissions()
  const allowed = canAccess([Permission.CommunicationView, Permission.CommunicationViewOwn])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState('')
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['customer-conversations', status],
    queryFn: () => customerFacingApi.conversations(status || undefined),
    enabled: allowed,
  })
  const detail = useQuery({
    queryKey: ['customer-conversation', selected],
    queryFn: () => customerFacingApi.conversation(selected),
    enabled: allowed && Boolean(selected),
  })
  const users = useUsers()
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customer-conversations'] })
    await queryClient.invalidateQueries({ queryKey: ['customer-conversation', selected] })
  }
  const act = useMutation({
    mutationFn: async (action: 'resolve' | 'reopen' | 'note' | 'assign') => {
      if (action === 'resolve') return customerFacingApi.resolve(selected)
      if (action === 'reopen') return customerFacingApi.reopen(selected)
      if (action === 'note') return customerFacingApi.note(selected, note)
      return customerFacingApi.assign(selected, assignee)
    },
    onSuccess: async () => {
      setNote('')
      await refresh()
    },
  })
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (list.data?.data ?? []).filter((row) => {
      if (!query) return true
      return [row.visitorName, row.visitorEmail, row.summary, row.intent].join(' ').toLowerCase().includes(query)
    })
  }, [list.data, search])

  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader title="Customer conversations" description="Public AI conversations for this business." />
        <p className="text-sm text-muted-foreground">You do not have permission to view customer conversations.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Customer conversations" description="Public AI conversations, detected intent, and handoffs. Internal notes stay off the customer chat." />
      <div className="flex flex-col gap-3 md:flex-row">
        <Input aria-label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or summary" />
        <select aria-label="Status" className="h-9 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="handoff">Handoff</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      {list.isLoading ? <p className="text-sm text-muted-foreground">Loading conversations…</p> : null}
      {list.isError ? <p role="alert" className="text-sm text-destructive">Customer conversations could not be loaded.</p> : null}
      {!list.isLoading && rows.length === 0 ? <p className="text-sm text-muted-foreground">No customer conversations match this view.</p> : null}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {rows.map((row) => (
            <button key={row.conversationId} type="button" className="w-full rounded-lg border px-3 py-3 text-left" onClick={() => setSelected(row.conversationId)}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.visitorName || 'Anonymous visitor'}</span>
                <Badge variant="outline">{label(row.status)}</Badge>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{label(row.intent)} · {row.confidence}</span>
              {row.handoffAt ? <span className="mt-1 block text-xs">Human help requested</span> : null}
            </button>
          ))}
        </div>
        {detail.data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{detail.data.visitorName || 'Anonymous visitor'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap">{detail.data.summary}</p>
              <p>Intent: {label(detail.data.intent)} ({detail.data.confidence}). {detail.data.intentEvidence}</p>
              <p>Source: {detail.data.intentSource}</p>
              {detail.data.handoffReason ? <p>Handoff: {detail.data.handoffReason}. A person has not replied unless a staff message is in the transcript.</p> : null}
              <p>Email: {detail.data.visitorEmail || 'Not provided'} · Phone: {detail.data.visitorPhone || 'Not provided'}</p>
              <p>Requirements: {detail.data.requirements || 'None stored'}</p>
              {detail.data.leadId ? <Link className="underline" to="/leads">Linked lead</Link> : <p>No lead is linked.</p>}
              <div className="space-y-2">
                {detail.data.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{message.role === 'internal' ? 'Internal note' : message.role}</p>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>
              <label className="block space-y-1">
                <span>Assign</span>
                <select aria-label="Team member" className="h-9 w-full rounded-lg border bg-background px-3" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                  <option value="">Select a team member</option>
                  {(users.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={!assignee || act.isPending} onClick={() => act.mutate('assign')}>Assign</Button>
                <Button type="button" disabled={act.isPending} onClick={() => act.mutate('resolve')}>Resolve</Button>
                <Button type="button" variant="outline" disabled={act.isPending} onClick={() => act.mutate('reopen')}>Reopen</Button>
              </div>
              <div className="flex gap-2">
                <Input aria-label="Internal note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note" />
                <Button type="button" variant="secondary" disabled={!note.trim() || act.isPending} onClick={() => act.mutate('note')}>Add note</Button>
              </div>
              {act.isError ? <p role="alert" className="text-destructive">That action could not be saved.</p> : null}
            </CardContent>
          </Card>
        ) : selected && detail.isLoading ? <p className="text-sm text-muted-foreground">Loading conversation…</p> : null}
        {selected && detail.isError ? <p role="alert" className="text-sm text-destructive">This conversation could not be loaded.</p> : null}
      </div>
    </div>
  )
}
