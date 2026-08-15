import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Plus, RefreshCw, UserRound, Users } from 'lucide-react'
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
import { useLeads } from '@/features/leads/hooks/use-leads'
import { ProspectDeleteDialog } from '@/features/prospects/components/prospect-delete-dialog'
import { ProspectForm } from '@/features/prospects/components/prospect-form'
import { ProspectsFilters } from '@/features/prospects/components/prospects-filters'
import { ProspectsTable } from '@/features/prospects/components/prospects-table'
import {
  useCreateProspect,
  useDeleteProspect,
  useProspects,
  useUpdateProspect,
} from '@/features/prospects/hooks/use-prospects'
import type {
  CreateProspectFormValues,
  UpdateProspectFormValues,
} from '@/features/prospects/schemas/prospect.schemas'
import type {
  CreateProspectRequest,
  Prospect,
  ProspectListQuery,
  ProspectStatus,
  UpdateProspectRequest,
} from '@/features/prospects/types/prospect.types'

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
  values: CreateProspectFormValues | UpdateProspectFormValues,
): CreateProspectRequest {
  return {
    companyId: values.companyId!,
    leadId: values.leadId!,
    firstName: values.firstName!.trim(),
    lastName: values.lastName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    jobTitle: values.jobTitle?.trim() || undefined,
    status: values.status,
    notes: values.notes?.trim() || undefined,
  }
}

function toUpdatePayload(
  values: CreateProspectFormValues | UpdateProspectFormValues,
): UpdateProspectRequest {
  return {
    companyId: values.companyId || undefined,
    leadId: values.leadId || undefined,
    firstName: values.firstName?.trim() || undefined,
    lastName: values.lastName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    jobTitle: values.jobTitle?.trim() || undefined,
    status: values.status,
    notes: values.notes?.trim() || undefined,
  }
}

function prospectErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (!(error instanceof ApiError)) return message

  if (error.status === 400) {
    if (
      /company not found/i.test(message) ||
      /lead not found/i.test(message) ||
      /lead does not belong/i.test(message)
    ) {
      return message
    }
  }

  if (error.status === 404 && /prospect not found/i.test(message)) {
    return message
  }

  return message
}

export function ProspectsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [deleting, setDeleting] = useState<Prospect | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const listQueryInput = useMemo<ProspectListQuery | undefined>(() => {
    const query: ProspectListQuery = {
      search: debouncedSearch.trim() || undefined,
      status: (status as ProspectStatus) || undefined,
      companyId: companyId || undefined,
      leadId: leadId || undefined,
    }
    if (!query.search && !query.status && !query.companyId && !query.leadId) {
      return undefined
    }
    return query
  }, [debouncedSearch, status, companyId, leadId])

  const companiesQuery = useCompanies()
  const leadsQuery = useLeads()
  const listQuery = useProspects(listQueryInput)
  const createMutation = useCreateProspect()
  const updateMutation = useUpdateProspect()
  const deleteMutation = useDeleteProspect()

  const companies = companiesQuery.data ?? []
  const leads = leadsQuery.data ?? []
  const items = listQuery.data ?? []

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const company of companies) {
      map.set(company.id, company.name)
    }
    return map
  }, [companies])

  const leadNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const lead of leads) {
      map.set(
        lead.id,
        [lead.firstName, lead.lastName].filter(Boolean).join(' '),
      )
    }
    return map
  }, [leads])

  const hasFilters = Boolean(search || status || companyId || leadId)
  const companiesReady = !companiesQuery.isLoading && !companiesQuery.isError
  const leadsReady = !leadsQuery.isLoading && !leadsQuery.isError
  const noCompanies = companiesReady && companies.length === 0
  const noLeads = companiesReady && leadsReady && leads.length === 0

  async function handleCreate(
    values: CreateProspectFormValues | UpdateProspectFormValues,
  ) {
    try {
      await createMutation.mutateAsync(
        toCreatePayload(values as CreateProspectFormValues),
      )
      toast.success('Prospect created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(prospectErrorMessage(error))
    }
  }

  async function handleUpdate(
    values: CreateProspectFormValues | UpdateProspectFormValues,
  ) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toUpdatePayload(values),
      })
      toast.success('Prospect updated')
      setEditing(null)
    } catch (error) {
      toast.error(prospectErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Prospect deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Prospects"
        description="Manage prospects for this tenant. Each prospect must belong to a company and a matching lead. Tenant scope comes from your JWT session."
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
              disabled={noCompanies || noLeads}
            >
              <Plus className="size-4" />
              Add prospect
            </Button>
          </>
        }
      />

      {noCompanies ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No companies available</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a company first. Prospects must be linked to a company and a
            lead.
          </p>
          <Button type="button" className="mt-4" asChild>
            <Link to="/companies">
              <Building2 className="size-4" />
              Go to Companies
            </Link>
          </Button>
        </div>
      ) : noLeads ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Create a lead first</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Prospects require a lead that belongs to a company. Create a lead
            before adding prospects.
          </p>
          <Button type="button" className="mt-4" asChild>
            <Link to="/leads">
              <Users className="size-4" />
              Go to Leads
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <ProspectsFilters
              search={search}
              status={status}
              companyId={companyId}
              leadId={leadId}
              companies={companies}
              leads={leads}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              onCompanyIdChange={setCompanyId}
              onLeadIdChange={setLeadId}
              onReset={() => {
                setSearch('')
                setStatus('')
                setCompanyId('')
                setLeadId('')
                setDebouncedSearch('')
              }}
            />
          </div>

          {listQuery.isLoading ||
          companiesQuery.isLoading ||
          leadsQuery.isLoading ? (
            <TableSkeleton />
          ) : listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load prospects</AlertTitle>
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
          ) : leadsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load leads</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{getErrorMessage(leadsQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void leadsQuery.refetch()}
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
                <UserRound className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">No prospects yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? 'No prospects match your search or filters. Try adjusting them.'
                  : 'Create your first prospect and link it to a company and lead.'}
              </p>
              {!hasFilters && (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Add prospect
                </Button>
              )}
            </motion.div>
          ) : (
            <ProspectsTable
              items={items}
              companyNameById={companyNameById}
              leadNameById={leadNameById}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add prospect</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped prospect via{' '}
              <code>POST /api/prospects</code>. Company and a matching lead are
              required.
            </DialogDescription>
          </DialogHeader>
          <ProspectForm
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
            <DialogTitle>Edit prospect</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/prospects/:id</code>. You can
              reassign company and lead within this tenant; the lead must belong
              to the selected company.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ProspectForm
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

      <ProspectDeleteDialog
        prospect={deleting}
        open={Boolean(deleting)}
        submitting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
