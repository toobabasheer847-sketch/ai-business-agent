import { useAuth } from '@/features/auth/hooks/use-auth'
import { hasAnyPermission, hasPermission, type PermissionName, type TenantRole } from '@/features/authorization/permissions'

export function usePermissions() {
  const { user, isBootstrapping } = useAuth()
  const role = user?.role

  return {
    role,
    isBootstrapping,
    hasRole: (expected: TenantRole) => role === expected,
    hasPermission: (permission: PermissionName) => hasPermission(role, permission),
    canAccess: (permissions?: readonly PermissionName[]) =>
      !permissions?.length || hasAnyPermission(role, permissions),
  }
}
