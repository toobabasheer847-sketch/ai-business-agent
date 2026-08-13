import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ModulePlaceholderPageProps = {
  title: string
  module: string
  endpoints: string[]
  availableInAppModule: boolean
  notes?: string
}

export function ModulePlaceholderPage({
  title,
  module,
  endpoints,
  availableInAppModule,
  notes,
}: ModulePlaceholderPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={`Feature shell for backend module \`${module}\`. Full UI will be implemented after plan approval.`}
      />

      {!availableInAppModule && (
        <Alert className="mb-4">
          <AlertTitle>Backend module not mounted</AlertTitle>
          <AlertDescription>
            Controllers and DTOs exist, but this module is not currently imported in{' '}
            <code>src/app.module.ts</code>. Routes will 404 until it is wired. No backend changes
            were made in this phase.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Known API surface</CardTitle>
          <CardDescription>Discovered from controllers — not invented.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {endpoints.map((endpoint) => (
              <li key={endpoint}>
                <code>{endpoint}</code>
              </li>
            ))}
          </ul>
          {notes && <p className="pt-2 text-sm text-muted-foreground">{notes}</p>}
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
