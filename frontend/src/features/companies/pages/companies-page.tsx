import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Plus, RefreshCw } from 'lucide-react'
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
import { CompaniesFilters } from '@/features/companies/components/companies-filters'
import { CompaniesTable } from '@/features/companies/components/companies-table'
import { CompanyDeleteDialog } from '@/features/companies/components/company-delete-dialog'
import { CompanyForm } from '@/features/companies/components/company-form'
import { RelatedTasksCard } from '@/features/tasks/components/related-tasks-card'
import {
  useCompanies,
  useCreateCompany,
  useDeleteCompany,
  useUpdateCompany,
} from '@/features/companies/hooks/use-companies'
import type {
  CreateCompanyFormValues,
  UpdateCompanyFormValues,
} from '@/features/companies/schemas/company.schemas'
import type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '@/features/companies/types/company.types'
import type { Company } from '@/features/companies/types/company.types'

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

function toCreatePayload(values: CreateCompanyFormValues): CreateCompanyRequest {
  return {
    name: values.name.trim(),
    domain: values.domain?.trim() || undefined,
    website: values.website?.trim() || undefined,
    industry: values.industry?.trim() || undefined,
    description: values.description?.trim() || undefined,
  }
}

function toUpdatePayload(values: UpdateCompanyFormValues): UpdateCompanyRequest {
  return {
    name: values.name?.trim() || undefined,
    domain: values.domain?.trim() || undefined,
    website: values.website?.trim() || undefined,
    industry: values.industry?.trim() || undefined,
    description: values.description?.trim() || undefined,
  }
}

export function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQuery = useCompanies(debouncedSearch || undefined)
  const createMutation = useCreateCompany()
  const updateMutation = useUpdateCompany()
  const deleteMutation = useDeleteCompany()

  const items = listQuery.data ?? []

  async function handleCreate(values: CreateCompanyFormValues) {
    try {
      await createMutation.mutateAsync(toCreatePayload(values))
      toast.success('Company created')
      setCreateOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          getErrorMessage(error) ||
            'A company with this name already exists for your tenant.',
        )
        return
      }
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: UpdateCompanyFormValues) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values),
      })
      toast.success('Company updated')
      setEditing(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          getErrorMessage(error) ||
            'A company with this name already exists for your tenant.',
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
      toast.success(result.message || 'Company deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage companies for this tenant. Tenant scope comes from your JWT session."
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
              Add company
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <CompaniesFilters
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
          <AlertTitle>Could not load companies</AlertTitle>
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
            <Building2 className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No companies yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search
              ? 'No companies match your search. Try a different name, domain, or industry.'
              : 'Create your first company for this tenant. Leads and prospects can link to companies later.'}
          </p>
          {!search && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Add company
            </Button>
          )}
        </motion.div>
      ) : (
        <CompaniesTable
          items={items}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped company via{' '}
              <code>POST /api/companies</code>.
            </DialogDescription>
          </DialogHeader>
          <CompanyForm
            mode="create"
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
            <DialogTitle>Edit company</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/companies/:id</code>. Tenant is
              enforced by the API.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-6">
              <CompanyForm
                key={editing.id}
                mode="edit"
                initial={editing}
                submitLabel="Save changes"
                submitting={updateMutation.isPending}
                onCancel={() => setEditing(null)}
                onSubmit={handleUpdate}
              />
              <RelatedTasksCard
                companyId={editing.id}
                entityLabel={editing.name}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CompanyDeleteDialog
        company={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
