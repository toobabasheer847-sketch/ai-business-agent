import { SetMetadata } from '@nestjs/common';

import type { PermissionName } from './permissions';

export const PERMISSIONS_METADATA_KEY = 'permissions';

export const Permissions = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
