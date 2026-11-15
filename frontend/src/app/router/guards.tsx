import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AccessDeniedPage } from '@/features/authorization/access-denied-page'
import { type PermissionName } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'

export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function Permit({ permissions, children }: { permissions: PermissionName[]; children: ReactNode }) {
  const { canAccess, isBootstrapping } = usePermissions()
  if (isBootstrapping) {
    return <Skeleton className="m-6 h-24 w-full max-w-xl" />
  }
  if (!canAccess(permissions)) return <AccessDeniedPage />
  return children
}

export function GuestRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Skeleton className="h-10 w-48" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
