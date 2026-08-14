import { AlertCircle, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'

type DashboardSectionErrorProps = {
  title?: string
  error: unknown
  onRetry?: () => void
}

export function DashboardSectionError({
  title = 'Could not load this section',
  error,
  onRetry,
}: DashboardSectionErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{getErrorMessage(error)}</span>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
