import { toast } from 'sonner'
import { Building2 } from 'lucide-react'

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
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api'
import { TenantForm } from '@/features/tenant/components/tenant-form'
import { useTenant, useUpdateTenant } from '@/features/tenant/hooks/use-tenant'
import type { UpdateTenantFormValues } from '@/features/tenant/schemas/tenant.schemas'

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

function TenantPageSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-28 ml-auto" />
      </CardContent>
    </Card>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-all text-sm">{value}</p>
    </div>
  )
}

export function TenantPage() {
  const tenantQuery = useTenant()
  const updateMutation = useUpdateTenant()

  async function handleUpdate(values: UpdateTenantFormValues) {
    try {
      await updateMutation.mutateAsync({ name: values.name })
      toast.success('Tenant updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const tenant = tenantQuery.data

  return (
    <div>
      <PageHeader
        title="Tenant"
        description="Organization profile for the authenticated tenant. Tenant identity comes from your JWT."
      />

      {tenantQuery.isLoading ? (
        <TenantPageSkeleton />
      ) : tenantQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load tenant</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(tenantQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void tenantQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !tenant ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Tenant not found</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            No tenant profile is available for this session.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-2xl gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your organization display name. Other fields are managed by
                the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TenantForm
                key={`${tenant.id}-${tenant.updatedAt}`}
                tenant={tenant}
                submitting={updateMutation.isPending}
                onSubmit={handleUpdate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Read-only identifiers and timestamps.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Tenant ID" value={tenant.id} />
              <ReadOnlyField label="Created" value={formatDate(tenant.createdAt)} />
              <ReadOnlyField label="Updated" value={formatDate(tenant.updatedAt)} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
