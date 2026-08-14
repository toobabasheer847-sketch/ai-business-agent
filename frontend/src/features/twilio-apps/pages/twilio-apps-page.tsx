import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plug, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/api'
import { usePhoneNumbers } from '@/features/phone-numbers/hooks/use-phone-numbers'
import type { PhoneNumber } from '@/features/phone-numbers/types/phone-number.types'
import { TwilioAppDetailDialog } from '@/features/twilio-apps/components/twilio-app-detail-dialog'
import { TwilioAppForm } from '@/features/twilio-apps/components/twilio-app-form'
import {
  TwilioAppsFilters,
  toTwilioAppQuery,
} from '@/features/twilio-apps/components/twilio-apps-filters'
import { TwilioAppsSummary } from '@/features/twilio-apps/components/twilio-apps-summary'
import { TwilioAppsTable } from '@/features/twilio-apps/components/twilio-apps-table'
import {
  useCreateTwilioApp,
  useDeleteTwilioApp,
  useTwilioApps,
  useUpdateTwilioApp,
} from '@/features/twilio-apps/hooks/use-twilio-apps'
import type {
  CreateTwilioAppFormValues,
  UpdateTwilioAppFormValues,
} from '@/features/twilio-apps/schemas/twilio-app.schemas'
import type { TwilioApp } from '@/features/twilio-apps/types/twilio-app.types'

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

export function TwilioAppsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [viewing, setViewing] = useState<TwilioApp | null>(null)
  const [editing, setEditing] = useState<TwilioApp | null>(null)
  const [deleting, setDeleting] = useState<TwilioApp | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useMemo(
    () =>
      toTwilioAppQuery({
        search: debouncedSearch,
        status,
        phoneNumberId,
      }),
    [debouncedSearch, status, phoneNumberId],
  )

  const listQuery = useTwilioApps(query)
  const allAppsQuery = useTwilioApps()
  const phoneNumbersQuery = usePhoneNumbers()
  const createMutation = useCreateTwilioApp()
  const updateMutation = useUpdateTwilioApp()
  const deleteMutation = useDeleteTwilioApp()

  const items = listQuery.data ?? []
  const allApps = allAppsQuery.data ?? []
  const phoneNumbers = phoneNumbersQuery.data ?? []
  const phoneNumbersById = useMemo(() => {
    const map = new Map<string, PhoneNumber>()
    for (const item of phoneNumbers) map.set(item.id, item)
    return map
  }, [phoneNumbers])

  async function handleCreate(values: CreateTwilioAppFormValues | UpdateTwilioAppFormValues) {
    try {
      await createMutation.mutateAsync({
        phoneNumberId: values.phoneNumberId,
        accountSid: values.accountSid,
        authToken: values.authToken || '',
        appSid: values.appSid || undefined,
        webhookUrl: values.webhookUrl || undefined,
        status: values.status,
      })
      toast.success('Twilio App created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: CreateTwilioAppFormValues | UpdateTwilioAppFormValues) {
    if (!editing) return
    try {
      const payload: {
        phoneNumberId: string
        accountSid: string
        appSid?: string
        webhookUrl?: string
        status: typeof values.status
        authToken?: string
      } = {
        phoneNumberId: values.phoneNumberId,
        accountSid: values.accountSid,
        appSid: values.appSid || undefined,
        webhookUrl: values.webhookUrl || undefined,
        status: values.status,
      }
      if (values.authToken?.trim()) {
        payload.authToken = values.authToken.trim()
      }
      await updateMutation.mutateAsync({
        id: editing.id,
        payload,
      })
      toast.success('Twilio App updated')
      setEditing(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Twilio App deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const hasFilters = Boolean(search || status || phoneNumberId)

  return (
    <div>
      <PageHeader
        title="Twilio Apps"
        description="Manage your Twilio applications and connect them with your business phone numbers."
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
              Add Twilio App
            </Button>
          </>
        }
      />

      <TwilioAppsSummary
        items={allApps}
        loading={allAppsQuery.isLoading}
      />

      <div className="mb-4">
        <TwilioAppsFilters
          search={search}
          status={status}
          phoneNumberId={phoneNumberId}
          phoneNumbers={phoneNumbers}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onPhoneNumberChange={setPhoneNumberId}
          onReset={() => {
            setSearch('')
            setStatus('')
            setPhoneNumberId('')
            setDebouncedSearch('')
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load Twilio Apps</AlertTitle>
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
            <Plug className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">
            {hasFilters ? 'No matching Twilio Apps' : 'No Twilio Apps yet'}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'No apps match your filters. Try adjusting search or filters.'
              : 'Connect a Twilio application to one of your business phone numbers to start managing your communication infrastructure.'}
          </p>
          {!hasFilters && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Add Twilio App
            </Button>
          )}
        </motion.div>
      ) : (
        <TwilioAppsTable
          items={items}
          phoneNumbersById={phoneNumbersById}
          onView={setViewing}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Twilio App</DialogTitle>
            <DialogDescription>
              Links Twilio credentials to a phone number. Tenant is taken from
              your JWT — never send tenantId from the form.
            </DialogDescription>
          </DialogHeader>
          <TwilioAppForm
            mode="create"
            phoneNumbers={phoneNumbers}
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
            <DialogTitle>Edit Twilio App</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/twilio-apps/:id</code>. Leave Auth
              Token blank to keep the existing value.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <TwilioAppForm
              key={editing.id}
              mode="edit"
              initial={editing}
              phoneNumbers={phoneNumbers}
              submitLabel="Save changes"
              submitting={updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <TwilioAppDetailDialog
        open={Boolean(viewing)}
        app={viewing}
        phoneNumber={
          viewing ? phoneNumbersById.get(viewing.phoneNumberId) : undefined
        }
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={setEditing}
      />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Twilio App?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The app linked to{' '}
              <strong>
                {deleting
                  ? phoneNumbersById.get(deleting.phoneNumberId)?.phoneNumber ??
                    'this phone number'
                  : 'this phone number'}
              </strong>{' '}
              will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
