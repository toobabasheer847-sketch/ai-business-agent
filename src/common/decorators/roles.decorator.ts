import { SetMetadata } from '@nestjs/common';

export const ROLE_METADATA_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLE_METADATA_KEY, roles);
