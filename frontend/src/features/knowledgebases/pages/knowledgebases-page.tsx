import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Plus, RefreshCw } from 'lucide-react'
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
import { KnowledgebasesFilters } from '@/features/knowledgebases/components/knowledgebases-filters'
import { KnowledgebasesTable } from '@/features/knowledgebases/components/knowledgebases-table'
import { KnowledgebaseDeleteDialog } from '@/features/knowledgebases/components/knowledgebase-delete-dialog'
import { KnowledgebaseDocumentsSheet } from '@/features/knowledgebases/components/knowledgebase-documents-sheet'
import { KnowledgebaseForm } from '@/features/knowledgebases/components/knowledgebase-form'
import {
  useKnowledgebases,
  useCreateKnowledgebase,
  useDeleteKnowledgebase,
  useUpdateKnowledgebase,
} from '@/features/knowledgebases/hooks/use-knowledgebases'
import type {
  CreateKnowledgebaseFormValues,
  UpdateKnowledgebaseFormValues,
} from '@/features/knowledgebases/schemas/knowledgebase.schemas'
import type {
  CreateKnowledgebaseRequest,
  Knowledgebase,
  UpdateKnowledgebaseRequest,
} from '@/features/knowledgebases/types/knowledgebase.types'

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
  values: CreateKnowledgebaseFormValues,
): CreateKnowledgebaseRequest {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
  }
}

function toUpdatePayload(
  values: UpdateKnowledgebaseFormValues,
): UpdateKnowledgebaseRequest {
  return {
    name: values.name?.trim() || undefined,
    description: values.description?.trim() || undefined,
  }
}

export function KnowledgebasesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Knowledgebase | null>(null)
  const [deleting, setDeleting] = useState<Knowledgebase | null>(null)
  const [documentsFor, setDocumentsFor] = useState<Knowledgebase | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQuery = useKnowledgebases(debouncedSearch || undefined)
  const createMutation = useCreateKnowledgebase()
  const updateMutation = useUpdateKnowledgebase()
  const deleteMutation = useDeleteKnowledgebase()

  const items = listQuery.data ?? []

  async function handleCreate(values: CreateKnowledgebaseFormValues) {
    try {
      await createMutation.mutateAsync(toCreatePayload(values))
      toast.success('Knowledgebase created')
      setCreateOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          getErrorMessage(error) ||
            'A knowledgebase with this name already exists for your tenant.',
        )
        return
      }
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: UpdateKnowledgebaseFormValues) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values),
      })
      toast.success('Knowledgebase updated')
      setEditing(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          getErrorMessage(error) ||
            'A knowledgebase with this name already exists for your tenant.',
        )
        return
      }
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Knowledgebase deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Knowledgebases"
        description="Manage knowledge bases for this tenant. Tenant scope comes from your JWT session."
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
              Add knowledgebase
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <KnowledgebasesFilters
          search={search}
          onSearchChange={setSearch}
          onReset={() => {
            setSearch('')
            setDebouncedSearch('')
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load knowledgebases</AlertTitle>
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
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No knowledgebases yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search
              ? 'No knowledgebases match your search. Try a different name.'
              : 'Create your first knowledgebase for this tenant. Use it to store and retrieve knowledge for AI agents.'}
          </p>
          {!search && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Add knowledgebase
            </Button>
          )}
        </motion.div>
      ) : (
        <KnowledgebasesTable
          items={items}
          onOpenDocuments={setDocumentsFor}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <KnowledgebaseDocumentsSheet
        knowledgebase={documentsFor}
        open={Boolean(documentsFor)}
        onOpenChange={(open) => !open && setDocumentsFor(null)}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add knowledgebase</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped knowledgebase via{' '}
              <code>POST /api/knowledgebases</code>.
            </DialogDescription>
          </DialogHeader>
          <KnowledgebaseForm
            mode="create"
            submitLabel="Create"
            submitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit knowledgebase</DialogTitle>
            <DialogDescription>
              Updates via{' '}
              <code>PATCH /api/knowledgebases/:id</code>. Tenant is enforced by
              the API.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <KnowledgebaseForm
              key={editing.id}
              mode="edit"
              initial={editing}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <KnowledgebaseDeleteDialog
        knowledgebase={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
