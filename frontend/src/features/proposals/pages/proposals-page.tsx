import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Plus, RefreshCw, UserRound } from 'lucide-react'
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
import { ProposalDeleteDialog } from '@/features/proposals/components/proposal-delete-dialog'
import { ProposalForm } from '@/features/proposals/components/proposal-form'
import { ProposalsFilters } from '@/features/proposals/components/proposals-filters'
import { ProposalsTable } from '@/features/proposals/components/proposals-table'
import {
  useCreateProposal,
  useDeleteProposal,
  useProposals,
  useUpdateProposal,
} from '@/features/proposals/hooks/use-proposals'
import type {
  CreateProposalFormValues,
  UpdateProposalFormValues,
} from '@/features/proposals/schemas/proposal.schemas'
import type {
  CreateProposalRequest,
  Proposal,
  ProposalListQuery,
  ProposalStatus,
  UpdateProposalRequest,
} from '@/features/proposals/types/proposal.types'
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
  values: CreateProposalFormValues,
): CreateProposalRequest {
  return {
    prospectId: values.prospectId.trim(),
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    content: values.content?.trim() || undefined,
    status: values.status,
  }
}

function toUpdatePayload(
  values: UpdateProposalFormValues,
): UpdateProposalRequest {
  return {
    title: values.title?.trim() || undefined,
    description: values.description?.trim() || undefined,
    content: values.content?.trim() || undefined,
    status: values.status,
  }
}

function proposalErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (!(error instanceof ApiError)) return message

  if (error.status === 400) {
    if (
      /prospect not found/i.test(message) ||
      /does not belong to your tenant/i.test(message) ||
      /cannot have its status changed/i.test(message)
    ) {
      return message
    }
  }

  if (error.status === 404 && /proposal not found/i.test(message)) {
    return message
  }

  return message
}

export function ProposalsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Proposal | null>(null)
  const [deleting, setDeleting] = useState<Proposal | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQueryInput = useMemo<ProposalListQuery | undefined>(() => {
    const query: ProposalListQuery = {
      search: debouncedSearch.trim() || undefined,
      status: (status as ProposalStatus) || undefined,
      prospectId: prospectId || undefined,
    }
    if (!query.search && !query.status && !query.prospectId) {
      return undefined
    }
    return query
  }, [debouncedSearch, status, prospectId])

  const prospectsQuery = useProspects()
  const listQuery = useProposals(listQueryInput)
  const createMutation = useCreateProposal()
  const updateMutation = useUpdateProposal()
  const deleteMutation = useDeleteProposal()

  const prospects = prospectsQuery.data ?? []
  const items = listQuery.data ?? []

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

  const hasFilters = Boolean(search || status || prospectId)
  const prospectsReady = !prospectsQuery.isLoading && !prospectsQuery.isError
  const noProspects = prospectsReady && prospects.length === 0

  async function handleCreate(
    values: CreateProposalFormValues | UpdateProposalFormValues,
  ) {
    try {
      await createMutation.mutateAsync(
        toCreatePayload(values as CreateProposalFormValues),
      )
      toast.success('Proposal created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(proposalErrorMessage(error))
    }
  }

  async function handleUpdate(
    values: CreateProposalFormValues | UpdateProposalFormValues,
  ) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values as UpdateProposalFormValues),
      })
      toast.success('Proposal updated')
      setEditing(null)
    } catch (error) {
      toast.error(proposalErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Proposal deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Proposals"
        description="Manage proposals for this tenant. Each proposal must belong to a prospect. Tenant scope comes from your JWT session."
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
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={noProspects}
            >
              <Plus className="size-4" />
              Add proposal
            </Button>
          </>
        }
      />

      {noProspects ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Create a prospect first</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Proposals require a prospect. Create a prospect before adding
            proposals.
          </p>
          <Button type="button" className="mt-4" asChild>
            <Link to="/prospects">
              <UserRound className="size-4" />
              Go to Prospects
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <ProposalsFilters
              search={search}
              status={status}
              prospectId={prospectId}
              prospects={prospects}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              onProspectIdChange={setProspectId}
              onReset={() => {
                setSearch('')
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
              <AlertTitle>Could not load proposals</AlertTitle>
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
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">No proposals yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? 'No proposals match your search or filters. Try adjusting them.'
                  : 'Create your first proposal and link it to a prospect.'}
              </p>
              {!hasFilters && (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Add proposal
                </Button>
              )}
            </motion.div>
          ) : (
            <ProposalsTable
              items={items}
              prospectNameById={prospectNameById}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add proposal</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped proposal via{' '}
              <code>POST /api/proposals</code>. A prospect is required.
            </DialogDescription>
          </DialogHeader>
          <ProposalForm
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
            <DialogTitle>Edit proposal</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/proposals/:id</code>. Prospect cannot
              be changed after creation.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ProposalForm
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

      <ProposalDeleteDialog
        proposal={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
