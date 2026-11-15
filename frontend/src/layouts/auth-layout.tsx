import { Outlet, useLocation } from 'react-router-dom'

import { APP_NAME } from '@/lib/constants/app'

export function AuthLayout() {
  const { pathname } = useLocation()
  const isRegister = pathname === '/register'

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,32rem)]">
      <section className="hidden flex-col justify-between border-r bg-sidebar px-10 py-10 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            AI
          </div>
          <p className="text-sm font-semibold">{APP_NAME}</p>
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">Run the work that needs a decision.</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Companies, leads, tasks, proposals, and the assistant stay in one tenant workspace. Counts on the dashboard come from your records.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Owner, admin, and member access follows the existing permissions.</p>
      </section>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground lg:mx-0">
              AI
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">
              {isRegister ? 'Create a tenant workspace' : 'Sign in to your tenant workspace'}
            </p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
