import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MessagesSquare, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api'
import { conversationsApi } from '@/features/conversations/api/conversations.api'
import { ConversationChannelBadge } from '@/features/conversations/components/conversation-channel-badge'
import { ConversationDeleteDialog } from '@/features/conversations/components/conversation-delete-dialog'
import { ConversationForm } from '@/features/conversations/components/conversation-form'
import { ConversationStatusBadge } from '@/features/conversations/components/conversation-status-badge'
import { ConversationsFilters } from '@/features/conversations/components/conversations-filters'
import { ConversationsTable } from '@/features/conversations/components/conversations-table'
import { MessageComposer } from '@/features/conversations/components/message-composer'
import { MessageList } from '@/features/conversations/components/message-list'
import {
  conversationKeys,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useUpdateConversation,
} from '@/features/conversations/hooks/use-conversations'
import {
  messageKeys,
  useConversationMessages,
  useDeleteMessage,
} from '@/features/conversations/hooks/use-messages'
import type {
  CreateConversationFormValues,
  CreateNestedMessageFormValues,
  UpdateConversationFormValues,
} from '@/features/conversations/schemas/conversation.schemas'
import type {
  Conversation,
  ConversationChannel,
  ConversationListQuery,
  ConversationStatus,
  CreateConversationRequest,
  CreateNestedMessageRequest,
  UpdateConversationRequest,
} from '@/features/conversations/types/conversation.types'
import { useProspects } from '@/features/prospects/hooks/use-prospects'

function TableSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-5/6" />
    </div>
  )
}

function toCreatePayload(
  values: CreateConversationFormValues,
): CreateConversationRequest {
  return {
    prospectId: values.prospectId?.trim() || undefined,
    title: values.title?.trim() || undefined,
    channel: values.channel,
    summary: values.summary?.trim() || undefined,
  }
}

function toUpdatePayload(
  values: UpdateConversationFormValues,
): UpdateConversationRequest {
  return {
    title: values.title?.trim() || undefined,
    channel: values.channel,
    status: values.status,
    summary: values.summary?.trim() || undefined,
  }
}

function conversationErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (!(error instanceof ApiError)) return message

  if (error.status === 404 && /conversation not found/i.test(message)) {
    return message
  }

  return message
}

function conversationTitle(item: Conversation) {
  return item.title?.trim() || 'Untitled conversation'
}

export function ConversationsPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const [viewing, setViewing] = useState<Conversation | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQueryInput = useMemo<ConversationListQuery | undefined>(() => {
    const query: ConversationListQuery = {
      search: debouncedSearch.trim() || undefined,
      channel: (channel as ConversationChannel) || undefined,
      status: (status as ConversationStatus) || undefined,
      prospectId: prospectId || undefined,
    }
    if (
      !query.search &&
      !query.channel &&
      !query.status &&
      !query.prospectId
    ) {
      return undefined
    }
    return query
  }, [debouncedSearch, channel, status, prospectId])

  const prospectsQuery = useProspects()
  const listQuery = useConversations(listQueryInput)
  const createMutation = useCreateConversation()
  const updateMutation = useUpdateConversation()
  const deleteMutation = useDeleteConversation()
  const deleteMessageMutation = useDeleteMessage()

  const messagesQuery = useConversationMessages(viewing?.id, undefined, Boolean(viewing))

  const addMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      payload,
    }: {
      conversationId: string
      payload: CreateNestedMessageRequest
    }) => conversationsApi.addMessage(conversationId, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.lists(data.conversationId),
      })
      queryClient.setQueryData(messageKeys.detail(data.id), data)
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(data.conversationId),
      })
    },
  })

  const prospects = prospectsQuery.data ?? []
  const items = listQuery.data ?? []
  const messages = messagesQuery.data ?? []

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

  const hasFilters = Boolean(search || channel || status || prospectId)
  const viewingProspectName = viewing?.prospectId
    ? (prospectNameById.get(viewing.prospectId) ?? 'Unknown prospect')
    : 'No prospect'

  async function handleCreate(
    values: CreateConversationFormValues | UpdateConversationFormValues,
  ) {
    try {
      await createMutation.mutateAsync(
        toCreatePayload(values as CreateConversationFormValues),
      )
      toast.success('Conversation created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(conversationErrorMessage(error))
    }
  }

  async function handleUpdate(
    values: CreateConversationFormValues | UpdateConversationFormValues,
  ) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values as UpdateConversationFormValues),
      })
      toast.success('Conversation updated')
      setEditing(null)
    } catch (error) {
      toast.error(conversationErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Conversation deleted')
      if (viewing?.id === deleting.id) setViewing(null)
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleSendMessage(values: CreateNestedMessageFormValues) {
    if (!viewing) return
    try {
      await addMessageMutation.mutateAsync({
        conversationId: viewing.id,
        payload: {
          role: values.role,
          content: values.content.trim(),
        },
      })
      toast.success('Message sent')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDeleteMessage(messageId: string, conversationId: string) {
    try {
      const result = await deleteMessageMutation.mutateAsync({
        id: messageId,
        conversationId,
      })
      toast.success(result.message || 'Message deleted')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Manage tenant conversations and message threads. Prospect linking is optional. Tenant scope comes from your JWT session."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw
                className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create conversation
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <ConversationsFilters
          search={search}
          channel={channel}
          status={status}
          prospectId={prospectId}
          prospects={prospects}
          onSearchChange={setSearch}
          onChannelChange={setChannel}
          onStatusChange={setStatus}
          onProspectIdChange={setProspectId}
          onReset={() => {
            setSearch('')
            setChannel('')
            setStatus('')
            setProspectId('')
            setDebouncedSearch('')
          }}
        />
      </div>

      {listQuery.isLoading || prospectsQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load conversations</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(listQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : prospectsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load prospects</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(prospectsQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void prospectsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <MessagesSquare className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No conversations yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? 'No conversations match your search or filters. Try adjusting them.'
              : 'Create a conversation to start a message thread. Prospect linking is optional.'}
          </p>
          {!hasFilters && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Create conversation
            </Button>
          )}
        </motion.div>
      ) : (
        <ConversationsTable
          items={items}
          prospectNameById={prospectNameById}
          onOpen={setViewing}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create conversation</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped conversation via{' '}
              <code>POST /api/conversations</code>. Prospect is optional.
            </DialogDescription>
          </DialogHeader>
          <ConversationForm
            mode="create"
            prospects={prospects}
            submitLabel="Create"
            submitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit conversation</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/conversations/:id</code>. Prospect
              cannot be changed after creation.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ConversationForm
              key={editing.id}
              mode="edit"
              initial={editing}
              prospects={prospects}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewing ? conversationTitle(viewing) : 'Conversation'}
            </DialogTitle>
            <DialogDescription>
              Message thread via nested conversation message endpoints. Messages
              are persistence only — no Twilio or realtime sending.
            </DialogDescription>
          </DialogHeader>

          {viewing ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <ConversationChannelBadge channel={viewing.channel} />
                <ConversationStatusBadge status={viewing.status} />
                <span className="text-muted-foreground">
                  Prospect: {viewingProspectName}
                </span>
              </div>
              {viewing.summary?.trim() ? (
                <p className="text-sm text-muted-foreground">{viewing.summary}</p>
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden">
                <MessageList
                  messages={messages}
                  loading={messagesQuery.isLoading}
                  error={
                    messagesQuery.isError
                      ? getErrorMessage(messagesQuery.error)
                      : null
                  }
                  onRetry={() => void messagesQuery.refetch()}
                  deletingId={
                    deleteMessageMutation.isPending
                      ? (deleteMessageMutation.variables?.id ?? null)
                      : null
                  }
                  onDelete={(message) =>
                    void handleDeleteMessage(message.id, viewing.id)
                  }
                />
              </div>

              <MessageComposer
                submitting={addMessageMutation.isPending}
                onSubmit={handleSendMessage}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConversationDeleteDialog
        conversation={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
