import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Plus, RefreshCw, ShoppingCart } from 'lucide-react'
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
import { BuyNumberDialog } from '@/features/phone-numbers/components/buy-number-dialog'
import { PhoneNumberForm } from '@/features/phone-numbers/components/phone-number-form'
import {
  PhoneNumbersFilters,
  toPhoneNumberQuery,
} from '@/features/phone-numbers/components/phone-numbers-filters'
import { PhoneNumbersTable } from '@/features/phone-numbers/components/phone-numbers-table'
import {
  useCreatePhoneNumber,
  useDeletePhoneNumber,
  useDisconnectTwilio,
  usePhoneNumbers,
  useUpdatePhoneNumber,
} from '@/features/phone-numbers/hooks/use-phone-numbers'
import type { PhoneNumberFormValues } from '@/features/phone-numbers/schemas/phone-number.schemas'
import type {
  CreatePhoneNumberPayload,
  PhoneNumber,
  UpdatePhoneNumberPayload,
} from '@/features/phone-numbers/types/phone-number.types'

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

export function PhoneNumbersPage() {
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [editing, setEditing] = useState<PhoneNumber | null>(null)
  const [deleting, setDeleting] = useState<PhoneNumber | null>(null)
  const [disconnecting, setDisconnecting] = useState<PhoneNumber | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useMemo(
    () =>
      toPhoneNumberQuery({
        search: debouncedSearch,
        provider,
        status,
      }),
    [debouncedSearch, provider, status],
  )

  const listQuery = usePhoneNumbers(query)
  const createMutation = useCreatePhoneNumber()
  const updateMutation = useUpdatePhoneNumber()
  const deleteMutation = useDeletePhoneNumber()
  const disconnectMutation = useDisconnectTwilio()

  const items = listQuery.data ?? []

  function toTwilioPayload(values: PhoneNumberFormValues, mode: 'create' | 'update') {
    const payload: CreatePhoneNumberPayload | UpdatePhoneNumberPayload = {
      phoneNumber: values.phoneNumber,
      label: values.label || undefined,
      provider: values.provider,
      status: values.status,
      twilioSid: values.twilioSid?.trim() ?? '',
      appSid: values.appSid?.trim() ?? '',
      webhookUrl: values.webhookUrl?.trim() ?? '',
    }

    if (values.authToken?.trim()) {
      payload.authToken = values.authToken.trim()
    } else if (mode === 'create') {
      payload.authToken = undefined
    }

    return payload
  }

  async function handleCreate(values: PhoneNumberFormValues) {
    try {
      await createMutation.mutateAsync(
        toTwilioPayload(values, 'create') as CreatePhoneNumberPayload,
      )
      toast.success('Phone number created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: PhoneNumberFormValues) {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: toTwilioPayload(values, 'update') as UpdatePhoneNumberPayload,
      })
      toast.success('Phone number updated')
      setEditing(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDisconnect() {
    if (!disconnecting) return
    try {
      await disconnectMutation.mutateAsync(disconnecting.id)
      toast.success('Twilio configuration disconnected')
      setDisconnecting(null)
      setEditing(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const result = await deleteMutation.mutateAsync(deleting.id)
      toast.success(result.message || 'Phone number deleted')
      setDeleting(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Phone Numbers"
        description="Manage tenant phone numbers for SMS and voice. Tenant scope comes from your JWT session."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw className={`size-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={() => setBuyOpen(true)}>
              <ShoppingCart className="size-4" />
              Buy a Number
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add number
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <PhoneNumbersFilters
          search={search}
          provider={provider}
          status={status}
          onSearchChange={setSearch}
          onProviderChange={setProvider}
          onStatusChange={setStatus}
          onReset={() => {
            setSearch('')
            setProvider('')
            setStatus('')
            setDebouncedSearch('')
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load phone numbers</AlertTitle>
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
            <Phone className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No phone numbers yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search || provider || status
              ? 'No numbers match your filters. Try adjusting search or filters.'
              : 'Register your first E.164 phone number for this tenant.'}
          </p>
          {!search && !provider && !status && (
            <Button type="button" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add number
            </Button>
          )}
        </motion.div>
      ) : (
        <PhoneNumbersTable items={items} onEdit={setEditing} onDelete={setDeleting} />
      )}

      <BuyNumberDialog open={buyOpen} onOpenChange={setBuyOpen} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add phone number</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped number via <code>POST /api/phone-numbers</code>.
              Optional Twilio credentials are stored on the same row.
            </DialogDescription>
          </DialogHeader>
          <PhoneNumberForm
            submitLabel="Create"
            submitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit phone number</DialogTitle>
            <DialogDescription>
              Updates via <code>PATCH /api/phone-numbers/:id</code>. Tenant is enforced by the API.
              Leave Auth Token blank to keep the stored token.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <PhoneNumberForm
              key={editing.id}
              initial={editing}
              submitLabel="Save configuration"
              submitting={updateMutation.isPending}
              disconnecting={disconnectMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
              onDisconnectTwilio={() => setDisconnecting(editing)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(disconnecting)}
        onOpenChange={(open) => !open && setDisconnecting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Twilio</DialogTitle>
            <DialogDescription>
              This clears Account SID, Auth Token, App SID, webhook URL, and Phone SID
              for <strong>{disconnecting?.phoneNumber}</strong>. The phone number itself is
              not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnecting(null)}
              disabled={disconnectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDisconnect()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect Twilio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete phone number</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{deleting?.phoneNumber}</strong>
              {deleting?.label ? ` (${deleting.label})` : ''}. To keep the number and only
              clear credentials, use Disconnect Twilio instead.
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
