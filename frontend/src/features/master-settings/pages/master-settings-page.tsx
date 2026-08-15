import { toast } from 'sonner'
import { Settings } from 'lucide-react'

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
import { MasterSettingsForm } from '@/features/master-settings/components/master-settings-form'
import {
  useMasterSettings,
  useUpdateMasterSettings,
} from '@/features/master-settings/hooks/use-master-settings'
import type { UpdateMasterSettingsFormValues } from '@/features/master-settings/schemas/master-settings.schemas'
import type { UpdateMasterSettingsRequest } from '@/features/master-settings/types/master-settings.types'

function MasterSettingsSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-28 ml-auto" />
      </CardContent>
    </Card>
  )
}

function toUpdatePayload(
  values: UpdateMasterSettingsFormValues,
): UpdateMasterSettingsRequest {
  return {
    defaultLanguage: values.defaultLanguage.trim(),
    defaultTimezone: values.defaultTimezone.trim(),
    defaultCurrency: values.defaultCurrency.trim(),
    aiModel: values.aiModel?.trim() ? values.aiModel.trim() : null,
    maxConversationHistory: values.maxConversationHistory,
    enableNotifications: values.enableNotifications,
    notificationEmail: values.notificationEmail?.trim()
      ? values.notificationEmail.trim()
      : null,
    businessHoursStart: values.businessHoursStart,
    businessHoursEnd: values.businessHoursEnd,
    isActive: values.isActive,
  }
}

export function MasterSettingsPage() {
  const settingsQuery = useMasterSettings()
  const updateMutation = useUpdateMasterSettings()

  async function handleUpdate(values: UpdateMasterSettingsFormValues) {
    try {
      await updateMutation.mutateAsync(toUpdatePayload(values))
      toast.success('Master settings updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const settings = settingsQuery.data

  return (
    <div>
      <PageHeader
        title="Master Settings"
        description="Tenant defaults for locale, AI, notifications, and business hours. Tenant scope comes from your JWT."
      />

      {settingsQuery.isLoading ? (
        <MasterSettingsSkeleton />
      ) : settingsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load master settings</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(settingsQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void settingsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !settings ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Settings unavailable</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            No master settings record was returned for this tenant.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Tenant defaults</CardTitle>
              <CardDescription>
                Updates are saved via PATCH /api/master-settings. Blank AI model or
                notification email clears those optional fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MasterSettingsForm
                key={`${settings.id}-${settings.updatedAt}`}
                settings={settings}
                submitting={updateMutation.isPending}
                onSubmit={handleUpdate}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
