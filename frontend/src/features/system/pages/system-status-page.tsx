import { useQuery } from '@tanstack/react-query'

import { checkApiHealth } from '@/lib/api'
import { API_URL } from '@/lib/constants/app'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function SystemStatusPage() {
  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: checkApiHealth,
    retry: false,
  })

  return (
    <div>
      <PageHeader
        title="System status"
        description="Verifies the frontend can reach the NestJS API using VITE_API_URL."
        actions={
          <Button variant="outline" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>
            {healthQuery.isFetching ? 'Checking…' : 'Recheck'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API base URL</CardTitle>
            <CardDescription>From environment</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 text-sm">{API_URL}</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">GET /api/</CardTitle>
            <CardDescription>AppController health-style root</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthQuery.isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : healthQuery.data?.ok ? (
              <>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Reachable</Badge>
                <p className="text-sm text-muted-foreground">{healthQuery.data.message}</p>
              </>
            ) : (
              <>
                <Badge variant="destructive">Unreachable</Badge>
                <p className="text-sm text-muted-foreground">
                  {healthQuery.data?.message ?? healthQuery.error?.message ?? 'Unknown error'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ensure the NestJS server is running on port 3000 and that CORS is enabled for the
                  Vite origin (see plan — backend change required).
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
