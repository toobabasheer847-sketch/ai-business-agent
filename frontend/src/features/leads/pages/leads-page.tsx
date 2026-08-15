import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Plus, RefreshCw, Users } from 'lucide-react'
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
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { LeadDeleteDialog } from '@/features/leads/components/lead-delete-dialog'
import { LeadForm } from '@/features/leads/components/lead-form'
import { LeadsFilters } from '@/features/leads/components/leads-filters'
import { LeadsTable } from '@/features/leads/components/leads-table'
import {
  useCreateLead,
  useDeleteLead,
  useLeads,
  useUpdateLead,
} from '@/features/leads/hooks/use-leads'
import type {
  CreateLeadFormValues,
  UpdateLeadFormValues,
} from '@/features/leads/schemas/lead.schemas'
import type {
  CreateLeadRequest,
  Lead,
  LeadListQuery,
  LeadStatus,
  UpdateLeadRequest,
} from '@/features/leads/types/lead.types'

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
  values: CreateLeadFormValues | UpdateLeadFormValues,
): CreateLeadRequest {
  return {
    companyId: values.companyId!,
    firstName: values.firstName!.trim(),
    lastName: values.lastName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    jobTitle: values.jobTitle?.trim() || undefined,
    source: values.source?.trim() || undefined,
    status: values.status,
    notes: values.notes?.trim() || undefined,
  }
}

function toUpdatePayload(
  values: CreateLeadFormValues | UpdateLeadFormValues,
): UpdateLeadRequest {
  return {
    companyId: values.companyId || undefined,
    firstName: values.firstName?.trim() || undefined,
    lastName: values.lastName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    jobTitle: values.jobTitle?.trim() || undefined,
    source: values.source?.trim() || undefined,
    status: values.status,
    notes: values.notes?.trim() || undefined,
  }
}

function leadErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (
    error instanceof ApiError &&
    error.status === 400 &&
    /company not found/i.test(message)
  ) {
    return message
  }
  return message
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [source, setSource] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedSource, setDebouncedSource] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSource(source), 300)
    return () => window.clearTimeout(timer)
  }, [source])

  const listQueryInput = useMemo<LeadListQuery | undefined>(() => {
    const query: LeadListQuery = {
      search: debouncedSearch.trim() || undefined,
      status: (status as LeadStatus) || undefined,
      companyId: companyId || undefined,
      source: debouncedSource.trim() || undefined,
    }
    if (!query.search && !query.status && !query.companyId && !query.source) {
      return undefined
    }
    return query
  }, [debouncedSearch, status, companyId, debouncedSource])

  const companiesQuery = useCompanies()
  const listQuery = useLeads(listQueryInput)
  const createMutation = useCreateLead()
  const updateMutation = useUpdateLead()
  const deleteMutation = useDeleteLead()

  const companies = companiesQuery.data ?? []
  const items = listQuery.data ?? []

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const company of companies) {
      map.set(company.id, company.name)
    }
    return map
  }, [companies])

  const hasFilters = Boolean(search || status || companyId || source)
  const companiesReady = !companiesQuery.isLoading && !companiesQuery.isError
  const noCompanies = companiesReady && companies.length === 0

  async function handleCreate(values: CreateLeadFormValues | UpdateLeadFormValues) {
    try {
      await createMutation.mutateAsync(toCreatePayload(values as CreateLeadFormValues))
      toast.success('Lead created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(leadErrorMessage(error))
    }
  }

  async function handleUpdate(values: CreateLeadFormValues | UpdateLeadFormValues) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values),
      })
      toast.success('Lead updated')
      setEditing(null)
    } catch (error) {
      toast.error(leadErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Lead deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Manage leads for this tenant. Each lead must belong to a company. Tenant scope comes from your JWT session."
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
              disabled={noCompanies}
            >
              <Plus className="size-4" />
              Add lead
            </Button>
          </>
        }
      />

      {noCompanies ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Create a company first</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Leads must be linked to a company. Create a company before adding
            leads.
          </p>
          <Button type="button" className="mt-4" asChild>
            <Link to="/companies">
              <Building2 className="size-4" />
              Go to Companies
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <LeadsFilters
              search={search}
              status={status}
              companyId={companyId}
              source={source}
              companies={companies}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              onCompanyIdChange={setCompanyId}
              onSourceChange={setSource}
              onReset={() => {
                setSearch('')
                setStatus('')
                setCompanyId('')
                setSource('')
                setDebouncedSearch('')
                setDebouncedSource('')
              }}
            />
          </div>

          {listQuery.isLoading || companiesQuery.isLoading ? (
            <TableSkeleton />
          ) : listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load leads</AlertTitle>
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
          ) : companiesQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load companies</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{getErrorMessage(companiesQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void companiesQuery.refetch()}
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
                <Users className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">No leads yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? 'No leads match your search or filters. Try adjusting them.'
                  : 'Create your first lead and link it to a company.'}
              </p>
              {!hasFilters && (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Add lead
                </Button>
              )}
            </motion.div>
          ) : (
            <LeadsTable
              items={items}
              companyNameById={companyNameById}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add lead</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped lead via <code>POST /api/leads</code>.
              Company is required.
            </DialogDescription>
          </DialogHeader>
          <LeadForm
            mode="create"
            companies={companies}
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
            <DialogTitle>Edit lead</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/leads/:id</code>. You can reassign
              the company within this tenant.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <LeadForm
              key={editing.id}
              mode="edit"
              initial={editing}
              companies={companies}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <LeadDeleteDialog
        lead={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
