import { useState } from 'react'
import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { GmailConfigurationForm } from '@/features/gmail-configuration/components/gmail-configuration-form'
import {
  useGmailConfiguration,
  useCreateGmailConfiguration,
  useUpdateGmailConfiguration,
  useDeleteGmailConfiguration,
} from '@/features/gmail-configuration/hooks/use-gmail-configuration'
import type {
  CreateGmailConfigurationFormValues,
} from '@/features/gmail-configuration/schemas/gmail-configuration.schemas'

function GmailConfigurationSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-28 ml-auto" />
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatTokenExpiry(expiry: string | null | undefined) {
  if (!expiry) return 'Not set'

  const date = new Date(expiry)
  const now = new Date()

  if (date < now) {
    return `Expired on ${formatDate(expiry)}`
  }

  return `Expires on ${formatDate(expiry)}`
}

export function GmailConfigurationPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const configQuery = useGmailConfiguration()
  const createMutation = useCreateGmailConfiguration()
  const updateMutation = useUpdateGmailConfiguration()
  const deleteMutation = useDeleteGmailConfiguration()

  const config = configQuery.data

  async function handleCreate(values: CreateGmailConfigurationFormValues) {
    try {
      await createMutation.mutateAsync({
        email: values.email.trim().toLowerCase(),
        clientId: values.clientId?.trim() || undefined,
        isActive: values.isActive,
      })
      toast.success('Gmail configuration created')
      setCreateOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUpdate(values: CreateGmailConfigurationFormValues) {
    try {
      await updateMutation.mutateAsync({
        email: values.email?.trim().toLowerCase(),
        clientId: values.clientId?.trim() || undefined,
        isActive: values.isActive,
      })
      toast.success('Gmail configuration updated')
      setEditOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    try {
      const result = await deleteMutation.mutateAsync()
      toast.success(result.message || 'Gmail configuration deleted')
      setDeleteOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail Configuration"
        description="Configure Gmail OAuth credentials for this tenant. Sensitive credentials are stored securely on the backend."
      />

      {configQuery.isLoading ? (
        <GmailConfigurationSkeleton />
      ) : configQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load Gmail configuration</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(configQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void configQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !config ? (
        <Card>
          <CardHeader>
            <CardTitle>No configuration</CardTitle>
            <CardDescription>Set up Gmail for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <Mail className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">Gmail not configured</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Connect Gmail to enable email integration. You'll need your Google Cloud OAuth
                credentials.
              </p>
              <Button
                type="button"
                className="mt-6"
                onClick={() => setCreateOpen(true)}
              >
                Configure Gmail
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Current configuration</CardTitle>
                <CardDescription>Gmail account and OAuth status for this workspace.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{config.email}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.isActive ? 'default' : 'secondary'}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">OAuth tokens</p>
                  <Badge variant={config.hasTokens ? 'secondary' : 'outline'}>
                    {config.hasTokens ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Token expiry</p>
                  <p className="text-sm">{formatTokenExpiry(config.tokenExpiry)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Client ID</p>
                  <p className="break-all text-sm font-mono text-muted-foreground">
                    {config.clientId ? `${config.clientId.substring(0, 20)}…` : '(not set)'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Updated</p>
                  <p className="text-sm">{formatDate(config.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                <p className="font-medium">About security</p>
                <p className="mt-1">
                  OAuth tokens (access, refresh) and Client Secret are encrypted and stored on
                  the backend only. The frontend never has access to these sensitive credentials.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update configuration</CardTitle>
              <CardDescription>
                Modify email address or OAuth credentials. Leave fields blank to keep existing
                values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GmailConfigurationForm
                key={`${config.id}-${config.updatedAt}`}
                initialData={config}
                submitting={updateMutation.isPending}
                onSubmit={handleUpdate}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Gmail</DialogTitle>
            <DialogDescription>
              Set up Gmail for this workspace. Provide your Gmail email address and optionally
              your Google Cloud OAuth credentials.
            </DialogDescription>
          </DialogHeader>

          <GmailConfigurationForm
            submitting={createMutation.isPending}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Gmail configuration</DialogTitle>
            <DialogDescription>
              Permanently delete all Gmail configuration and stored credentials for this
              workspace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
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
