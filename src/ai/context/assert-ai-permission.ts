import { ForbiddenException } from '@nestjs/common';

import { hasAnyPermission, type PermissionName } from '../../modules/authorization/permissions';

export function assertRolePermission(role: unknown, permissions: readonly PermissionName[]): void {
  if (!hasAnyPermission(role, permissions)) {
    throw new ForbiddenException('You do not have permission for this action.');
  }
}
