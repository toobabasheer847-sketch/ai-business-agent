import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function AccessDeniedPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Your role does not include this part of the workspace. The server enforces the same limit.
      </p>
      <Button asChild variant="outline" className="w-fit">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}
