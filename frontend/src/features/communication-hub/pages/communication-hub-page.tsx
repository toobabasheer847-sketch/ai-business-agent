import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Inbox,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
} from 'lucide-react'

import { DashboardKpiCard } from '@/features/dashboard/components/dashboard-kpi-card'
import {
  useCommunicationHubDetail,
  useCommunicationHubEmailThreads,
  useCommunicationHubHistory,
  useCommunicationHubSmsThreads,
  useCommunicationHubStats,
} from '@/features/communication-hub/hooks/use-communication-hub'
import type {
  CommunicationChannel,
  CommunicationHubHistoryItem,
} from '@/features/communication-hub/types/communication-hub.types'
import { useProspects } from '@/features/prospects/hooks/use-prospects'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const channelOptions: Array<{ value: 'all' | CommunicationChannel; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'call', label: 'Call' },
  { value: 'web', label: 'Web' },
]

function formatDate(value?: string) {
  if (!value) return '—'

  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function channelBadgeVariant(channel: CommunicationChannel) {
  switch (channel) {
    case 'email':
      return 'secondary'
    case 'sms':
      return 'outline'
    case 'call':
      return 'default'
    case 'web':
      return 'ghost'
    default:
      return 'secondary'
  }
}

function titleFromHistory(item: CommunicationHubHistoryItem) {
  return item.title?.trim() || 'Untitled conversation'
}

export function CommunicationHubPage() {
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState<'all' | CommunicationChannel>('all')
  const [prospectId, setProspectId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const listQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      channel: channel === 'all' ? undefined : channel,
      prospectId: prospectId || undefined,
      page,
      limit: 8,
    }),
    [channel, page, prospectId, search],
  )

  const statsQuery = useCommunicationHubStats()
  const historyQuery = useCommunicationHubHistory(listQuery)
  const emailThreadsQuery = useCommunicationHubEmailThreads({ page: 1, limit: 4 })
  const smsThreadsQuery = useCommunicationHubSmsThreads({ page: 1, limit: 4 })
  const detailQuery = useCommunicationHubDetail(selectedId ?? undefined, Boolean(selectedId))
  const prospectsQuery = useProspects()

  const history = historyQuery.data?.data ?? []
  const stats = statsQuery.data
  const totalPages = historyQuery.data?.totalPages ?? 1
  const prospects = prospectsQuery.data ?? []

  const prospectNameById = useMemo(() => {
    const map = new Map<string, string>()

    for (const prospect of prospects) {
      map.set(
        prospect.id,
        [prospect.firstName, prospect.lastName].filter(Boolean).join(' '),
      )
    }

    return map
  }, [prospects])

  const hasFilters = Boolean(search || channel !== 'all' || prospectId)

  function resetFilters() {
    setSearch('')
    setChannel('all')
    setProspectId('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication Hub"
        description="Unified view of email, SMS, and call activity across your active prospects."
        actions={
          <Button variant="outline" size="sm" onClick={() => historyQuery.refetch()}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardKpiCard
          title="Total conversations"
          value={stats?.totalConversations}
          description="All tracked conversations"
          icon={MessageSquareText}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          errorMessage={statsQuery.error ? 'Could not load summary.' : undefined}
        />
        <DashboardKpiCard
          title="Email"
          value={stats?.emailConversations}
          description="Email conversations"
          icon={Send}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          errorMessage={statsQuery.error ? 'Could not load email totals.' : undefined}
        />
        <DashboardKpiCard
          title="SMS"
          value={stats?.smsConversations}
          description="SMS conversations"
          icon={Inbox}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          errorMessage={statsQuery.error ? 'Could not load SMS totals.' : undefined}
        />
        <DashboardKpiCard
          title="Calls"
          value={stats?.callConversations}
          description="Call records"
          icon={ArrowUpRight}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          errorMessage={statsQuery.error ? 'Could not load call totals.' : undefined}
        />
        <DashboardKpiCard
          title="Active"
          value={stats?.activeConversations}
          description="Open conversations"
          icon={RefreshCcw}
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          errorMessage={statsQuery.error ? 'Could not load activity.' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thread directory</CardTitle>
          <CardDescription>Search and filter across the unified communication history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
                placeholder="Search title or summary…"
                className="pl-9"
                aria-label="Search communication history"
              />
            </div>

            <Select
              value={channel}
              onValueChange={(value) => {
                setPage(1)
                setChannel((value as 'all' | CommunicationChannel) || 'all')
              }}
            >
              <SelectTrigger className="w-full lg:w-[170px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={prospectId || 'all'}
              onValueChange={(value) => {
                setPage(1)
                setProspectId(value === 'all' ? '' : value)
              }}
            >
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Prospect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All prospects</SelectItem>
                {prospects.map((prospect) => (
                  <SelectItem key={prospect.id} value={prospect.id}>
                    {[prospect.firstName, prospect.lastName]
                      .filter(Boolean)
                      .join(' ') || 'Unnamed prospect'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            )}
          </div>

          {historyQuery.isLoading ? (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : historyQuery.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Unable to load communication history. Please try again.
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No communication history matches the current filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => {
                    const prospectName = item.prospectId
                      ? prospectNameById.get(item.prospectId) ?? 'Unknown prospect'
                      : 'No prospect'

                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{titleFromHistory(item)}</p>
                            {item.summary ? (
                              <p className="max-w-md truncate text-xs text-muted-foreground">
                                {item.summary}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={channelBadgeVariant(item.channel)}>
                            {item.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {prospectName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.messageCount}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.updatedAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {historyQuery.data && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Page {historyQuery.data.page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email threads</CardTitle>
            <CardDescription>Latest email conversations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {emailThreadsQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-10 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : (emailThreadsQuery.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No email threads available.</p>
            ) : (
              (emailThreadsQuery.data?.data ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{titleFromHistory(item)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</p>
                  </div>
                  <Badge variant="secondary">{item.messageCount}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SMS threads</CardTitle>
            <CardDescription>Latest SMS conversations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {smsThreadsQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-10 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : (smsThreadsQuery.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No SMS threads available.</p>
            ) : (
              (smsThreadsQuery.data?.data ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{titleFromHistory(item)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</p>
                  </div>
                  <Badge variant="outline">{item.messageCount}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          {detailQuery.isLoading ? (
            <div className="space-y-3 py-4">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded bg-muted" />
              <div className="h-16 animate-pulse rounded bg-muted" />
            </div>
          ) : detailQuery.data ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailQuery.data.title || 'Untitled conversation'}</DialogTitle>
                <DialogDescription>
                  {detailQuery.data.channel} · {detailQuery.data.status}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {detailQuery.data.summary || 'No summary available for this conversation.'}
                </div>

                <div className="space-y-3">
                  {detailQuery.data.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages recorded.</p>
                  ) : (
                    detailQuery.data.messages.map((message) => (
                      <div key={message.id} className="rounded-lg border p-3">
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="font-medium uppercase tracking-wide text-foreground">
                            {message.role}
                          </span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
